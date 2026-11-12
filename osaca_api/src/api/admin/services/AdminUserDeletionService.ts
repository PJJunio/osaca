// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import type {AdminBanManagementService} from '@app/api/admin/services/AdminBanManagementService';
import {collectKnownUserIps} from '@app/api/admin/services/KnownUserIps';
import {type ReporterResolutionNotifier, wasReporterNotified} from '@app/api/admin/services/ReporterResolutionNotifier';
import {revokeAllAuthSessions} from '@app/api/auth/AuthSessionRevocation';
import {createReportID, type UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {EnforcementDecisionRow} from '@app/api/database/types/EnforcementTypes';
import {cancelClosure} from '@app/api/enforcement/ClosureState';
import type {EnforcementActor} from '@app/api/enforcement/EnforcementActor';
import {
	decisionAuditMetadata,
	type EnforcementDecisionService,
	type RecordedDecision,
} from '@app/api/enforcement/EnforcementDecisionService';
import type {EnforcementNoticeDelivery} from '@app/api/enforcement/EnforcementNoticeDelivery';
import {emitAdminAction} from '@app/api/infrastructure/activity/AccountChangeEvents';
import type {KVAccountDeletionQueueService} from '@app/api/infrastructure/KVAccountDeletionQueueService';
import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import type {OAuth2TokenRepository} from '@app/api/oauth/repositories/OAuth2TokenRepository';
import {type IARSubmission, ReportStatus} from '@app/api/report/ReportModels';
import type {ReportService} from '@app/api/report/ReportService';
import {getReportSearchService} from '@app/api/SearchFactory';
import {isEnforcementDeletionReason} from '@app/api/user/ProfileVisibility';
import {
	type PartialUserChangePropagationDeps,
	propagateUserUpdate,
} from '@app/api/user/services/PartialUserChangePropagation';
import {reschedulePendingDeletion} from '@app/api/user/services/PendingDeletionCoordinator';
import {isDeletionComplete, isHeldByDecision} from '@app/api/user/UserHelpers';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {
	ACCOUNT_DELETION_MIN_DAYS,
	ENFORCEMENT_CLOSURE_MIN_DAYS,
	ENFORCEMENT_REASONS,
	ENFORCEMENT_RULES,
} from '@osaca/constants/src/EnforcementReasons';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {ConflictError} from '@osaca/errors/src/domains/core/ConflictError';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import {NoPendingDeletionError} from '@osaca/errors/src/domains/core/NoPendingDeletionError';
import {EnforcementDecisionOwnsStateError} from '@osaca/errors/src/domains/moderation/EnforcementDecisionOwnsStateError';
import {ReportAlreadyResolvedError} from '@osaca/errors/src/domains/moderation/ReportAlreadyResolvedError';
import type {
	AdminUserDeletionCancelRequest,
	AdminUserDeletionScheduleRequest,
} from '@osaca/schema/src/domains/admin/AdminUserSchemas';

interface AdminUserDeletionServiceDeps {
	apiContext: ApiContext;
	auditService: AdminAuditService;
	banManagementService: AdminBanManagementService;
	reportService: ReportService;
	userUpdateDeps: PartialUserChangePropagationDeps;
	kvDeletionQueue: KVAccountDeletionQueueService;
	oauth2Tokens: Pick<OAuth2TokenRepository, 'deleteAllAccessTokensForUser' | 'deleteAllRefreshTokensForUser'>;
	reporterResolutionNotifier: ReporterResolutionNotifier;
	enforcement: EnforcementDecisionService;
	delivery: EnforcementNoticeDelivery;
}

type AutoResolveOutcome = 'completed' | 'search_unavailable' | 'enumeration_failed';

interface AutoResolveSummary {
	outcome: AutoResolveOutcome;
	foundCount: number;
	resolvedCount: number;
	failedCount: number;
	notifiedCount: number;
}

type ClosureBasisType = AdminUserDeletionScheduleRequest['basis']['type'];

const BASIS_DELETION_REASONS = {
	holder_request: DeletionReasons.USER_REQUESTED,
	housekeeping: DeletionReasons.INACTIVITY,
} as const;

const reportResolvingDeletionReasons: ReadonlySet<number> = new Set([
	DeletionReasons.SPAM,
	DeletionReasons.CHEATING_OR_EXPLOITATION,
	DeletionReasons.COORDINATED_RAIDING,
	DeletionReasons.AUTOMATION_OR_SELFBOT,
	DeletionReasons.SCAM_OR_SOCIAL_ENGINEERING,
	DeletionReasons.HARASSMENT_OR_BULLYING,
	DeletionReasons.BAN_EVASION,
	DeletionReasons.TOKEN_OR_CREDENTIAL_SCAM,
	DeletionReasons.HATE_SPEECH_OR_EXTREMIST_CONTENT,
	DeletionReasons.MALICIOUS_LINKS_OR_MALWARE,
	DeletionReasons.IMPERSONATION_OR_FAKE_IDENTITY,
]);

const manuallyResolvedReportCategories: ReadonlySet<string> = new Set(['child_safety', 'underage_user', 'self_harm']);

function describePendingDeletion(user: User, prefix: string): Array<[string, string]> {
	if (!user.pendingDeletionAt) return [];
	return [
		[`${prefix}_pending_deletion_at`, user.pendingDeletionAt.toISOString()],
		[`${prefix}_scheduled_by`, user.deletionScheduledBy?.toString() ?? ''],
		[`${prefix}_scheduled_at`, user.deletionScheduledAt?.toISOString() ?? ''],
		[`${prefix}_reason_code`, user.deletionReasonCode?.toString() ?? ''],
	];
}

function sameInstant(left: Date, right: string): boolean {
	return left.getTime() === new Date(right).getTime();
}

export function resolveDeletionDays(basis: ClosureBasisType, requestedDays: number): number {
	const appealable = basis === 'enforcement' && !Config.instance.selfHosted;
	return Math.max(requestedDays, appealable ? ENFORCEMENT_CLOSURE_MIN_DAYS : ACCOUNT_DELETION_MIN_DAYS);
}

function closedFlags(user: User, enforcement: boolean): bigint {
	if (!enforcement) {
		return (user.flags & ~UserFlags.DELETED) | UserFlags.SELF_DELETED;
	}
	const flags = (user.flags | UserFlags.DELETED) & ~UserFlags.SELF_DELETED;
	return user.tempBannedUntil ? flags & ~UserFlags.DISABLED : flags;
}

export class AdminUserDeletionService {
	constructor(private readonly deps: AdminUserDeletionServiceDeps) {}

	async scheduleAccountDeletion(userId: UserID, request: AdminUserDeletionScheduleRequest, actor: EnforcementActor) {
		const user = await this.applyScheduledDeletion(userId, request, actor);
		return {user: await mapUserToAdminResponse(user, this.deps.apiContext.services.cache, actor.acls)};
	}

	async applyScheduledDeletion(
		userId: UserID,
		request: AdminUserDeletionScheduleRequest,
		actor: EnforcementActor,
	): Promise<User> {
		const {basis} = request;
		const user = await this.deps.apiContext.services.users.findUniqueAssert(userId);
		if (isDeletionComplete(user)) {
			throw new ConflictError({
				code: APIErrorCodes.CONFLICT,
				message: 'This account has already been deleted',
			});
		}
		if (
			user.pendingDeletionAt &&
			(!request.replace_pending_deletion_at ||
				!sameInstant(user.pendingDeletionAt, request.replace_pending_deletion_at))
		) {
			throw new ConflictError({
				code: APIErrorCodes.CONFLICT,
				message: 'A deletion is already scheduled for this account',
			});
		}
		if (basis.type !== 'enforcement') {
			if (isHeldByDecision(user)) {
				throw new EnforcementDecisionOwnsStateError(user.enforcementDecisionId!);
			}
			if (request.remove_evidence) {
				throw InputValidationError.fromCode('remove_evidence', ValidationErrorCodes.ENFORCEMENT_EVIDENCE_REQUIRED);
			}
		}
		const immediate = request.immediate === true;
		if (immediate && !Config.instance.selfHosted) {
			throw InputValidationError.create('immediate', 'Immediate deletion is only available on self-hosted instances');
		}
		const days = immediate ? 0 : resolveDeletionDays(basis.type, request.days_until_deletion);
		const scheduledAt = new Date();
		const pendingDeletionAt = new Date(scheduledAt);
		pendingDeletionAt.setDate(pendingDeletionAt.getDate() + days);
		let closed = user;
		let recorded: RecordedDecision | null = null;
		if (basis.type === 'enforcement') {
			recorded = await this.deps.enforcement.record(
				{
					subject: {type: 'user', user},
					kind: 'closure',
					input: basis.decision,
					endsAt: null,
					deletionAt: pendingDeletionAt,
					removeEvidence: request.remove_evidence ?? false,
					actor,
				},
				async (decisionId) => {
					closed = await this.writeClosure(user, {
						reasonCode: basis.decision.reason_code,
						pendingDeletionAt,
						scheduledAt,
						actorId: actor.adminUserId,
						decisionId,
					});
				},
			);
		} else {
			closed = await this.writeClosure(user, {
				reasonCode: BASIS_DELETION_REASONS[basis.type],
				pendingDeletionAt,
				scheduledAt,
				actorId: actor.adminUserId,
				decisionId: null,
			});
		}
		await this.deps.auditService.createAuditLog({
			adminUserId: actor.adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'schedule_deletion',
			auditLogReason: actor.internalNote,
			metadata: new Map([
				['basis', basis.type],
				['days', days.toString()],
				['reason_code', closed.deletionReasonCode?.toString() ?? ''],
				['pending_deletion_at', pendingDeletionAt.toISOString()],
				...(immediate ? ([['immediate', 'true']] as Array<[string, string]>) : []),
				...describePendingDeletion(user, 'replaced'),
				...(recorded ? decisionAuditMetadata(recorded.decision) : []),
			]),
		});
		const decision = recorded?.decision ?? null;
		const knownIps = decision ? await this.banIdentifiers(user, decision) : new Set<string>();
		if (decision && reportResolvingDeletionReasons.has(decision.reason_code)) {
			await this.resolvePendingReportsAgainstUser({user, adminUserId: actor.adminUserId});
		}
		await emitAdminAction(actor.adminUserId, userId, 'schedule_deletion', {
			reasonCode: closed.deletionReasonCode,
			ips: knownIps,
		});
		await propagateUserUpdate(this.deps.userUpdateDeps, user, closed);
		if (immediate) {
			await this.deps.apiContext.services.worker.addJob('userProcessPendingDeletion', {
				userId: userId.toString(),
				deletionReasonCode: closed.deletionReasonCode ?? BASIS_DELETION_REASONS.housekeeping,
				pendingDeletionAt: pendingDeletionAt.toISOString(),
			});
		}
		return closed;
	}

	async cancelAccountDeletion(userId: UserID, data: AdminUserDeletionCancelRequest, actor: EnforcementActor) {
		const {cache} = this.deps.apiContext.services;
		const user = await this.deps.apiContext.services.users.findUniqueAssert(userId);
		if (!user.pendingDeletionAt) {
			throw new NoPendingDeletionError();
		}
		if (user.enforcementDecisionId !== null) {
			throw new EnforcementDecisionOwnsStateError(user.enforcementDecisionId);
		}
		if (!sameInstant(user.pendingDeletionAt, data.expected_pending_deletion_at)) {
			throw new ConflictError({
				code: APIErrorCodes.CONFLICT,
				message: 'The pending deletion does not match expected_pending_deletion_at',
			});
		}
		const cancelled = await cancelClosure(this.deps, user);
		const enforcementClosure = isEnforcementDeletionReason(user.deletionReasonCode);
		if (enforcementClosure) {
			await this.deps.delivery.sendLegacyEnded(user);
		}
		await this.deps.auditService.createAuditLog({
			adminUserId: actor.adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'cancel_deletion',
			auditLogReason: actor.internalNote,
			metadata: new Map([
				...describePendingDeletion(user, 'cancelled'),
				...(enforcementClosure ? ([['notice', 'enforcement_ended']] as Array<[string, string]>) : []),
			]),
		});
		await emitAdminAction(actor.adminUserId, userId, 'cancel_deletion');
		return {user: await mapUserToAdminResponse(cancelled, cache, actor.acls)};
	}

	private async writeClosure(
		user: User,
		params: {
			reasonCode: number;
			pendingDeletionAt: Date;
			scheduledAt: Date;
			actorId: UserID;
			decisionId: bigint | null;
		},
	): Promise<User> {
		const {users} = this.deps.apiContext.services;
		const {decisionId} = params;
		const closed = await users.updateDeletionSchedule(user, {
			flags: closedFlags(user, decisionId !== null),
			pending_deletion_at: params.pendingDeletionAt,
			deletion_reason_code: params.reasonCode,
			deletion_scheduled_by: params.actorId,
			deletion_scheduled_at: params.scheduledAt,
			...(decisionId !== null ? {enforcement_decision_id: decisionId, temp_banned_until: null} : {}),
		});
		await reschedulePendingDeletion({
			userId: user.id,
			currentPendingDeletionAt: user.pendingDeletionAt,
			nextPendingDeletionAt: params.pendingDeletionAt,
			deletionReasonCode: params.reasonCode,
			deletionQueue: this.deps.kvDeletionQueue,
		});
		await revokeAllAuthSessions(this.deps.apiContext.services, user.id);
		await this.deps.oauth2Tokens.deleteAllAccessTokensForUser(user.id);
		await this.deps.oauth2Tokens.deleteAllRefreshTokensForUser(user.id);
		return closed;
	}

	private async banIdentifiers(user: User, decision: EnforcementDecisionRow): Promise<ReadonlySet<string>> {
		const {rule} = ENFORCEMENT_REASONS[decision.reason_code];
		if (!ENFORCEMENT_RULES[rule].barsNewAccounts) {
			return new Set();
		}
		return collectKnownUserIps(this.deps.apiContext.services.users, user);
	}

	private async resolvePendingReportsAgainstUser(params: {user: User; adminUserId: UserID}): Promise<void> {
		const {user, adminUserId} = params;
		const {reportService, reporterResolutionNotifier} = this.deps;
		const auditLogReason = 'auto-resolved on scheduled deletion of reported user';
		const summary: AutoResolveSummary = {
			outcome: 'completed',
			foundCount: 0,
			resolvedCount: 0,
			failedCount: 0,
			notifiedCount: 0,
		};
		const reportSearchService = getReportSearchService();
		if (!reportSearchService) {
			Logger.warn(
				{userId: user.id.toString()},
				'Report search is unavailable; pending reports were not auto-resolved on scheduled deletion',
			);
			summary.outcome = 'search_unavailable';
			await this.recordAutoResolveSummary({user, adminUserId, auditLogReason, summary});
			return;
		}
		const pageSize = 100;
		const pendingReportIds = new Set<string>();
		let offset = 0;
		try {
			while (true) {
				const {hits} = await reportSearchService.searchReports(
					'',
					{
						reportedUserId: user.id.toString(),
						status: ReportStatus.PENDING,
					},
					{limit: pageSize, offset},
				);
				if (hits.length === 0) break;
				for (const hit of hits) {
					if (manuallyResolvedReportCategories.has(hit.category)) continue;
					pendingReportIds.add(hit.id);
				}
				offset += hits.length;
				if (hits.length < pageSize) break;
			}
		} catch (error) {
			summary.outcome = 'enumeration_failed';
			Logger.warn(
				{error, userId: user.id.toString()},
				'Failed to enumerate pending reports for auto-resolution on scheduled deletion',
			);
		}
		summary.foundCount = pendingReportIds.size;
		for (const hitId of pendingReportIds) {
			const reportId = createReportID(BigInt(hitId));
			let resolvedReport: IARSubmission;
			try {
				resolvedReport = await reportService.resolveReport(reportId, adminUserId, null, auditLogReason, {
					outcome: 'actioned',
					resolvedBy: 'system',
					reporterOutcome: 'restricted',
				});
			} catch (error) {
				if (error instanceof ReportAlreadyResolvedError) continue;
				summary.failedCount++;
				Logger.warn(
					{error, userId: user.id.toString(), reportId: reportId.toString()},
					'Failed to auto-resolve report on scheduled deletion',
				);
				continue;
			}
			summary.resolvedCount++;
			const notice = await reporterResolutionNotifier.notifyReporterOfResolution(resolvedReport, null, 'restricted');
			if (wasReporterNotified(notice)) {
				summary.notifiedCount++;
			}
		}
		await this.recordAutoResolveSummary({user, adminUserId, auditLogReason, summary});
	}

	private async recordAutoResolveSummary(params: {
		user: User;
		adminUserId: UserID;
		auditLogReason: string;
		summary: AutoResolveSummary;
	}): Promise<void> {
		const {user, adminUserId, auditLogReason, summary} = params;
		await this.deps.auditService
			.createAuditLog({
				adminUserId,
				targetType: 'user',
				targetId: BigInt(user.id),
				action: 'auto_resolve_reports_on_deletion',
				auditLogReason,
				metadata: new Map([
					['outcome', summary.outcome],
					['found_count', summary.foundCount.toString()],
					['resolved_count', summary.resolvedCount.toString()],
					['failed_count', summary.failedCount.toString()],
					['notified_count', summary.notifiedCount.toString()],
				]),
			})
			.catch((error) => {
				Logger.warn(
					{error, userId: user.id.toString(), ...summary},
					'Failed to write audit log for auto-resolved reports on scheduled deletion',
				);
			});
	}
}
