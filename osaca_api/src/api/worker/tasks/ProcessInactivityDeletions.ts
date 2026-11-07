// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {EnforcementDecisionRepository} from '@app/api/enforcement/EnforcementDecisionRepository';
import {clearExpiredSuspension} from '@app/api/enforcement/SuspensionState';
import type {IGatewayService} from '@app/api/infrastructure/IGatewayService';
import type {KVAccountDeletionQueueService} from '@app/api/infrastructure/KVAccountDeletionQueueService';
import type {KVActivityTracker} from '@app/api/infrastructure/KVActivityTracker';
import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import {scheduleSystemDeletion} from '@app/api/user/AccountCleanup';
import {hasWayBackIn} from '@app/api/user/AccountTier';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {
	type PartialUserChangePropagationDeps,
	propagateUserUpdate,
} from '@app/api/user/services/PartialUserChangePropagation';
import type {UserDeletionEligibilityService} from '@app/api/user/services/UserDeletionEligibilityService';
import {isDeletionComplete} from '@app/api/user/UserHelpers';
import {mapWithConcurrency} from '@app/api/utils/ConcurrencyUtils';
import {getWorkerDependencies} from '@app/api/worker/WorkerContext';
import {
	AccountCleanupDefaults,
	CleanupModes,
	LastSessionCleanupModes,
} from '@osaca/constants/src/AccountConfigConstants';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import type {AccountsConfig} from '@osaca/schema/src/domains/admin/AccountsConfigSchemas';
import {snowflakeToDate} from '@osaca/snowflake/src/Snowflake';
import type {IKVProvider} from '@pkgs/kv_client/src/IKVProvider';
import type {WorkerTaskHandler} from '@pkgs/worker/src/contracts/WorkerTask';
import {ms} from 'itty-time';

const BATCH_SIZE = 100;
const USER_PROCESSING_CONCURRENCY = 8;

interface InactivityCheckResult {
	deletionsScheduled: number;
	suspensionsCleared: number;
	errors: number;
}

type AccountCleanupConfig = Pick<AccountsConfig, 'unclaimed_account_cleanup'>;

function daysMs(days: number): number {
	return days * ms('1 day');
}

function sweepsAbandonedAccounts(cleanup: AccountCleanupConfig): boolean {
	return (
		cleanup.unclaimed_account_cleanup.mode !== CleanupModes.OFF ||
		cleanup.unclaimed_account_cleanup.on_last_session_end !== LastSessionCleanupModes.OFF
	);
}

interface ProcessUserDeps {
	cleanup: AccountCleanupConfig;
	userRepository: UserRepository;
	deletionQueueService: KVAccountDeletionQueueService;
	gatewayService: IGatewayService;
	activityTracker: KVActivityTracker;
	deletionEligibilityService: UserDeletionEligibilityService;
	decisionRepository: Pick<EnforcementDecisionRepository, 'get' | 'endIfActive'>;
	userUpdateDeps: PartialUserChangePropagationDeps;
}

async function clearSuspensionIfExpired(
	user: User,
	deps: ProcessUserDeps,
	result: InactivityCheckResult,
): Promise<User> {
	const expiry = await clearExpiredSuspension({users: deps.userRepository, repository: deps.decisionRepository}, user);
	if (!expiry) return user;
	await propagateUserUpdate(deps.userUpdateDeps, expiry.previous, expiry.cleared);
	result.suspensionsCleared++;
	Logger.debug({userId: user.id}, 'Cleared an expired suspension');
	return expiry.cleared;
}

async function loadPageActivities(
	activityTracker: KVActivityTracker,
	users: ReadonlyArray<User>,
): Promise<ReadonlyMap<UserID, Date | null> | null> {
	try {
		return await activityTracker.getActivities(users.map((user) => user.id));
	} catch (error) {
		Logger.warn({error}, 'Batched activity lookup failed, falling back to per-user activity lookups');
		return null;
	}
}

async function processUser(
	listedUser: User,
	deps: ProcessUserDeps,
	pageActivities: ReadonlyMap<UserID, Date | null> | null,
	result: InactivityCheckResult,
): Promise<void> {
	const {userRepository, deletionQueueService, gatewayService, activityTracker, deletionEligibilityService} = deps;
	if (isDeletionComplete(listedUser)) return;
	const user = await clearSuspensionIfExpired(listedUser, deps, result);
	const userId = user.id;
	if (user.pendingDeletionAt) {
		Logger.debug({userId}, 'User already pending deletion, skipping');
		return;
	}
	if (user.isBot) {
		Logger.debug({userId}, 'User is a bot, skipping');
		return;
	}
	if (user.flags & UserFlags.APP_STORE_REVIEWER) {
		Logger.debug({userId}, 'User is an app store reviewer, skipping');
		return;
	}
	if (!sweepsAbandonedAccounts(deps.cleanup)) return;
	const prefetchedActivity = pageActivities?.get(userId);
	const lastActivity =
		prefetchedActivity !== undefined ? prefetchedActivity : await activityTracker.getActivity(userId);
	const now = new Date();
	const lastKnownActivity = lastActivity ?? user.lastActiveAt ?? snowflakeToDate(BigInt(userId));
	const abandonedInactiveMs = now.getTime() - lastKnownActivity.getTime();
	const reasonCode = await abandonedAccountReason(user, abandonedInactiveMs, userRepository, deps.cleanup);
	const current = reasonCode === null ? null : await userRepository.findUnique(userId);
	const currentReason =
		current === null ||
		current.pendingDeletionAt ||
		(await deletionEligibilityService.isProtectedFromSystemDeletion(current))
			? null
			: await abandonedAccountReason(current, abandonedInactiveMs, userRepository, deps.cleanup);
	if (current !== null && currentReason !== null) {
		await scheduleSystemDeletion(
			{users: userRepository, gateway: gatewayService, deletionQueue: deletionQueueService},
			current,
			{
				reasonCode: currentReason,
				delayMs: AccountCleanupDefaults.SCHEDULED_DELETION_GRACE_MS,
				cancelledBySignIn: true,
				endSessions: true,
			},
		);
		result.deletionsScheduled++;
	}
}

async function abandonedAccountReason(
	user: User,
	inactiveMs: number,
	userRepository: UserRepository,
	cleanup: AccountCleanupConfig,
): Promise<number | null> {
	const unclaimed = cleanup.unclaimed_account_cleanup;
	const afterInactivity = unclaimed.mode === CleanupModes.AFTER_INACTIVITY;
	const afterLastSession = unclaimed.on_last_session_end === LastSessionCleanupModes.AFTER_GRACE;
	if (!afterInactivity && !afterLastSession) return null;
	if (await hasWayBackIn({users: userRepository}, user)) return null;
	if (afterInactivity && inactiveMs >= daysMs(unclaimed.inactive_days)) {
		return DeletionReasons.UNCLAIMED_ACCOUNT_ABANDONED;
	}
	if (!afterLastSession) return null;
	const createdAt = snowflakeToDate(BigInt(user.id)).getTime();
	if (Date.now() - createdAt < AccountCleanupDefaults.MIN_ACCOUNT_AGE_MS) return null;
	const sessions = await userRepository.listAuthSessions(user.id);
	return sessions.length === 0 ? DeletionReasons.UNCLAIMED_ACCOUNT_ABANDONED : null;
}

interface ProcessInactivityDeletionsDeps {
	cleanup: AccountCleanupConfig;
	kvClient: IKVProvider;
	userRepository: UserRepository;
	deletionQueueService: KVAccountDeletionQueueService;
	gatewayService: IGatewayService;
	activityTracker: KVActivityTracker;
	deletionEligibilityService: UserDeletionEligibilityService;
	userUpdateDeps: PartialUserChangePropagationDeps;
}

export async function processInactivityDeletionsCore(
	deps: ProcessInactivityDeletionsDeps,
): Promise<InactivityCheckResult> {
	const {
		cleanup,
		userRepository,
		deletionQueueService,
		gatewayService,
		activityTracker,
		deletionEligibilityService,
		userUpdateDeps,
	} = deps;
	const result: InactivityCheckResult = {
		deletionsScheduled: 0,
		suspensionsCleared: 0,
		errors: 0,
	};
	Logger.debug('Starting inactivity deletion check');
	const needsRebuild = await activityTracker.needsRebuild();
	if (needsRebuild) {
		Logger.info('Activity tracker needs rebuild, rebuilding from Cassandra');
		await activityTracker.rebuildActivities();
	}
	const userDeps: ProcessUserDeps = {
		cleanup,
		userRepository,
		deletionQueueService,
		gatewayService,
		activityTracker,
		deletionEligibilityService,
		decisionRepository: new EnforcementDecisionRepository(),
		userUpdateDeps,
	};
	let pageState: string | null = null;
	let processedUsers = 0;
	do {
		const page = await userRepository.scanAllUsersPage(BATCH_SIZE, pageState);
		pageState = page.pageState;
		const users = page.users;
		if (users.length === 0) continue;
		const pageActivities = await loadPageActivities(activityTracker, users);
		await mapWithConcurrency(users, USER_PROCESSING_CONCURRENCY, async (user) => {
			try {
				await processUser(user, userDeps, pageActivities, result);
			} catch (userError) {
				Logger.error({error: userError, userId: user.id}, 'Failed to process inactive user');
				result.errors++;
			}
		});
		processedUsers += users.length;
		if (processedUsers % 1000 === 0) {
			Logger.debug({processedUsers, deletionsScheduled: result.deletionsScheduled}, 'Inactivity deletion progress');
		}
	} while (pageState);
	Logger.info(
		{
			processedUsers,
			deletionsScheduled: result.deletionsScheduled,
			suspensionsCleared: result.suspensionsCleared,
			errors: result.errors,
		},
		'Completed inactivity deletion processing',
	);
	return result;
}

const processInactivityDeletions: WorkerTaskHandler = async (_payload, helpers) => {
	helpers.logger.debug('Processing processInactivityDeletions task');
	const {
		kvClient,
		userRepository,
		deletionQueueService,
		gatewayService,
		instanceConfigRepository,
		activityTracker,
		deletionEligibilityService,
		userCacheService,
		guildRepository,
	} = getWorkerDependencies();
	await processInactivityDeletionsCore({
		cleanup: await instanceConfigRepository.getAccountsConfig(),
		kvClient,
		userRepository,
		deletionQueueService,
		gatewayService,
		activityTracker,
		deletionEligibilityService,
		userUpdateDeps: {userCacheService, gatewayService, userRepository, guildRepository},
	});
};

export default processInactivityDeletions;
