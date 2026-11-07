// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import type {SudoVerificationResult} from '@app/api/auth/services/SudoVerificationService';
import type {ConnectionRepository} from '@app/api/connection/ConnectionRepository';
import type {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import type {GuildService} from '@app/api/guild/services/GuildService';
import {GuildMemberSearchIndexService} from '@app/api/guild/services/member/GuildMemberSearchIndexService';
import type {DiscriminatorService} from '@app/api/infrastructure/DiscriminatorService';
import type {EntityAssetService} from '@app/api/infrastructure/EntityAssetService';
import type {KVAccountDeletionQueueService} from '@app/api/infrastructure/KVAccountDeletionQueueService';
import type {UserCacheService} from '@app/api/infrastructure/UserCacheService';
import {Logger} from '@app/api/Logger';
import type {LimitConfigService} from '@app/api/limits/LimitConfigService';
import type {AuthSession} from '@app/api/models/AuthSession';
import type {User} from '@app/api/models/User';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {
	type PartialUserChangePropagationDeps,
	propagateUserUpdate,
} from '@app/api/user/services/PartialUserChangePropagation';
import {UserAccountLifecycleService} from '@app/api/user/services/UserAccountLifecycleService';
import {UserAccountLookupService} from '@app/api/user/services/UserAccountLookupService';
import {UserAccountNotesService} from '@app/api/user/services/UserAccountNotesService';
import {UserAccountProfileService} from '@app/api/user/services/UserAccountProfileService';
import {
	type AuthSessionReplacement,
	UserAccountSecurityService,
} from '@app/api/user/services/UserAccountSecurityService';
import {UserAccountSettingsService} from '@app/api/user/services/UserAccountSettingsService';
import {UserAccountUpdatePropagator} from '@app/api/user/services/UserAccountUpdatePropagator';
import type {UserContactChangeLogService} from '@app/api/user/services/UserContactChangeLogService';
import {runAllInOrder} from '@app/api/utils/ConcurrencyUtils';
import type {UserUpdateRequest} from '@osaca/schema/src/domains/user/UserRequestSchemas';

interface UpdateUserParams {
	user: User;
	oldAuthSession: AuthSession;
	data: UserUpdateRequest;
	request: Request;
	sudoContext?: SudoVerificationResult;
}

interface UpdateUserResult {
	user: User;
	authSessionReplacement: AuthSessionReplacement | null;
}

export class UserAccountService {
	readonly lookupService: UserAccountLookupService;
	private readonly profileService: UserAccountProfileService;
	private readonly securityService: UserAccountSecurityService;
	readonly settingsService: UserAccountSettingsService;
	readonly notesService: UserAccountNotesService;
	readonly lifecycleService: UserAccountLifecycleService;
	readonly updatePropagator: UserAccountUpdatePropagator;
	private readonly userUpdateDeps: PartialUserChangePropagationDeps;
	private readonly userAccountRepository: UserRepository;
	private readonly guildRepository: GuildRepository;
	private readonly searchIndexService: GuildMemberSearchIndexService;

	constructor(
		private readonly apiContext: ApiContext,
		userCacheService: UserCacheService,
		guildService: GuildService,
		entityAssetService: EntityAssetService,
		guildRepository: GuildRepository,
		discriminatorService: DiscriminatorService,
		kvDeletionQueue: KVAccountDeletionQueueService,
		private readonly contactChangeLogService: UserContactChangeLogService,
		connectionRepository: ConnectionRepository,
		readonly limitConfigService: LimitConfigService,
	) {
		const {
			users: userAccountRepository,
			gateway: gatewayService,
			rateLimit: rateLimitService,
		} = this.apiContext.services;
		this.userUpdateDeps = {userCacheService, gatewayService, userRepository: userAccountRepository, guildRepository};
		this.userAccountRepository = userAccountRepository;
		this.guildRepository = guildRepository;
		this.searchIndexService = new GuildMemberSearchIndexService();
		this.updatePropagator = new UserAccountUpdatePropagator({gatewayService});
		this.lookupService = new UserAccountLookupService({
			userAccountRepository,

			guildRepository,
			guildService,
			discriminatorService,
			connectionRepository,
		});
		this.profileService = new UserAccountProfileService({
			userAccountRepository,
			guildRepository,
			entityAssetService,
			rateLimitService,
			limitConfigService,
		});
		this.securityService = new UserAccountSecurityService({
			apiContext: this.apiContext,
			userAccountRepository,
			discriminatorService,
			rateLimitService,
			limitConfigService,
		});
		this.settingsService = new UserAccountSettingsService({
			userAccountRepository,

			updatePropagator: this.updatePropagator,
			gatewayService,
			userCacheService,
			guildRepository,
			limitConfigService,
		});
		this.notesService = new UserAccountNotesService({
			userAccountRepository,

			updatePropagator: this.updatePropagator,
		});
		this.lifecycleService = new UserAccountLifecycleService({
			apiContext: this.apiContext,
			userAccountRepository,
			guildRepository,
			userUpdateDeps: this.userUpdateDeps,
			kvDeletionQueue,
		});
	}

	async update(params: UpdateUserParams): Promise<UpdateUserResult> {
		const {user, oldAuthSession, data, request, sudoContext} = params;
		const profileResult = await this.profileService.processProfileUpdates({user, data});
		const securityResult = await this.securityService.processSecurityUpdates({user, data, sudoContext});
		const updates = {
			...securityResult.updates,
			...profileResult.updates,
		};
		let updatedUser: User;
		try {
			updatedUser = await this.userAccountRepository.patchUpsert(user.id, updates, user.toRow());
		} catch (error) {
			Logger.error(
				{error, userId: user.id},
				'User profile update failed with unknown commit status; retaining uploaded assets',
			);
			throw error;
		} finally {
			await securityResult.metadata.usernameReservation?.release();
		}
		const finalizationSteps: Array<() => Promise<unknown>> = [
			() =>
				this.contactChangeLogService.recordDiff({
					oldUser: user,
					newUser: updatedUser,
					reason: 'user_requested',
					actorUserId: user.id,
				}),
			async () => {
				try {
					await this.profileService.commitAssetChanges(profileResult);
				} catch (error) {
					Logger.error({error, userId: user.id}, 'Failed to commit asset changes after successful DB update');
				}
			},
			() => propagateUserUpdate(this.userUpdateDeps, user, updatedUser, {continueAfterDispatchFailure: true}),
			async () => {
				const nameChanged =
					user.username !== updatedUser.username ||
					user.discriminator !== updatedUser.discriminator ||
					user.globalName !== updatedUser.globalName;
				if (nameChanged) {
					void this.reindexGuildMembersForUser(updatedUser);
				}
			},
		];
		let authSessionReplacement: AuthSessionReplacement | null = null;
		if (securityResult.metadata.invalidateAuthSessions) {
			finalizationSteps.push(
				async () => {
					authSessionReplacement = await this.securityService.invalidateAndRecreateSessions({
						user,
						oldAuthSession,
						request,
					});
				},
				() => this.userAccountRepository.deleteAllPasswordResetTokens(user.id),
			);
		}
		await runAllInOrder(finalizationSteps, 'Failed to finalize user update');
		return {user: updatedUser, authSessionReplacement};
	}

	private async reindexGuildMembersForUser(updatedUser: User): Promise<void> {
		try {
			const guildIds = await this.userAccountRepository.getUserGuildIds(updatedUser.id);
			await this.searchIndexService.updateUserMembers(updatedUser, guildIds, this.guildRepository);
		} catch (error) {
			Logger.error({userId: updatedUser.id.toString(), error}, 'Failed to reindex guild members after user update');
		}
	}
}
