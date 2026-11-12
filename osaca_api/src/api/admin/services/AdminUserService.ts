// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import type {AdminBanManagementService} from '@app/api/admin/services/AdminBanManagementService';
import {AdminUserCreationService} from '@app/api/admin/services/AdminUserCreationService';
import {AdminUserDeletionService} from '@app/api/admin/services/AdminUserDeletionService';
import {AdminUserLookupService} from '@app/api/admin/services/AdminUserLookupService';
import {AdminUserProfileService} from '@app/api/admin/services/AdminUserProfileService';
import {AdminUserSecurityService} from '@app/api/admin/services/AdminUserSecurityService';
import type {ReporterResolutionNotifier} from '@app/api/admin/services/ReporterResolutionNotifier';
import {createUserID, type UserID} from '@app/api/BrandedTypes';
import type {ChannelRepository} from '@app/api/channel/ChannelRepository';
import type {EnforcementDecisionService} from '@app/api/enforcement/EnforcementDecisionService';
import type {EnforcementNoticeDelivery} from '@app/api/enforcement/EnforcementNoticeDelivery';
import type {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import type {DiscriminatorService} from '@app/api/infrastructure/DiscriminatorService';
import type {EntityAssetService} from '@app/api/infrastructure/EntityAssetService';
import type {KVAccountDeletionQueueService} from '@app/api/infrastructure/KVAccountDeletionQueueService';
import type {KVBulkMessageDeletionQueueService} from '@app/api/infrastructure/KVBulkMessageDeletionQueueService';
import type {UserCacheService} from '@app/api/infrastructure/UserCacheService';
import {OAuth2TokenRepository} from '@app/api/oauth/repositories/OAuth2TokenRepository';
import type {ReportService} from '@app/api/report/ReportService';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import type {PartialUserChangePropagationDeps} from '@app/api/user/services/PartialUserChangePropagation';
import type {CancelBulkMessageDeletionRequest} from '@osaca/schema/src/domains/admin/AdminUserSchemas';
import type {ICacheService} from '@pkgs/cache/src/ICacheService';

interface AdminUserServiceDeps {
	apiContext: ApiContext;
	guildRepository: GuildRepository;
	channelRepository: ChannelRepository;
	discriminatorService: DiscriminatorService;
	entityAssetService: EntityAssetService;
	auditService: AdminAuditService;
	userCacheService: UserCacheService;
	banManagementService: AdminBanManagementService;
	kvDeletionQueue: KVAccountDeletionQueueService;
	bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService;
	reportService: ReportService;
	reporterResolutionNotifier: ReporterResolutionNotifier;
	enforcement: EnforcementDecisionService;
	delivery: EnforcementNoticeDelivery;
}

export class AdminUserService {
	readonly lookupService: AdminUserLookupService;
	readonly profileService: AdminUserProfileService;
	readonly securityService: AdminUserSecurityService;
	readonly deletionService: AdminUserDeletionService;
	readonly creationService: AdminUserCreationService;
	private readonly userUpdateDeps: PartialUserChangePropagationDeps;
	private readonly auditService: AdminAuditService;
	private readonly userRepository: UserRepository;
	private readonly bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService;
	private readonly cacheService: ICacheService;

	constructor(deps: AdminUserServiceDeps) {
		const {users, cache, gateway} = deps.apiContext.services;
		this.userUpdateDeps = {
			userCacheService: deps.userCacheService,
			userRepository: users,
			guildRepository: deps.guildRepository,
			gatewayService: gateway,
		};
		this.userRepository = users;
		this.auditService = deps.auditService;
		this.bulkMessageDeletionQueue = deps.bulkMessageDeletionQueue;
		this.cacheService = cache;
		this.lookupService = new AdminUserLookupService({
			apiContext: deps.apiContext,
		});
		this.profileService = new AdminUserProfileService({
			apiContext: deps.apiContext,
			discriminatorService: deps.discriminatorService,
			entityAssetService: deps.entityAssetService,
			auditService: deps.auditService,
			userUpdateDeps: this.userUpdateDeps,
			guildRepository: deps.guildRepository,
			enforcement: deps.enforcement,
		});
		this.securityService = new AdminUserSecurityService({
			apiContext: deps.apiContext,
			auditService: deps.auditService,
			userUpdateDeps: this.userUpdateDeps,
		});
		this.creationService = new AdminUserCreationService({
			apiContext: deps.apiContext,
			auditService: deps.auditService,
			discriminatorService: deps.discriminatorService,
			securityService: this.securityService,
		});
		this.deletionService = new AdminUserDeletionService({
			apiContext: deps.apiContext,
			auditService: deps.auditService,
			banManagementService: deps.banManagementService,
			reportService: deps.reportService,
			userUpdateDeps: this.userUpdateDeps,
			kvDeletionQueue: deps.kvDeletionQueue,
			oauth2Tokens: new OAuth2TokenRepository(),
			reporterResolutionNotifier: deps.reporterResolutionNotifier,
			enforcement: deps.enforcement,
			delivery: deps.delivery,
		});
	}

	async cancelBulkMessageDeletion(
		data: CancelBulkMessageDeletionRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const userId = createUserID(data.user_id);
		const user = await this.userRepository.findUniqueAssert(userId);
		const updatedUser = await this.userRepository.patchUpsert(
			userId,
			{
				pending_bulk_message_deletion_at: null,
				pending_bulk_message_deletion_channel_count: null,
				pending_bulk_message_deletion_message_count: null,
			},
			user.toRow(),
		);
		await this.bulkMessageDeletionQueue.removeFromQueue(userId);
		await this.auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'cancel_bulk_message_deletion',
			auditLogReason,
			metadata: new Map(),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, this.cacheService, acls),
		};
	}
}
