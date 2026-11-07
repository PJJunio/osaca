// SPDX-License-Identifier: AGPL-3.0-or-later

import {AdminAuditReadActions} from '@app/api/admin/AdminAuditActions';
import {recordAdminRead} from '@app/api/admin/AdminAuditRecorder';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import {createSignInLink} from '@app/api/auth/SignInLinks';
import {createUserID} from '@app/api/BrandedTypes';
import {enforcementActor} from '@app/api/enforcement/EnforcementActor';
import {hasAdminACL, requireAdminACL} from '@app/api/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {inputValidationErrorFromZodIssues, Validator} from '@app/api/Validator';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {AccessDeniedError} from '@osaca/errors/src/domains/core/AccessDeniedError';
import {ListUserGuildsResponse} from '@osaca/schema/src/domains/admin/AdminGuildSchemas';
import {SearchUsersResponse} from '@osaca/schema/src/domains/admin/AdminSchemas';
import {
	AdminAclListResponse,
	AdminSignInLinkResponse,
	AdminUserAclsRequest,
	AdminUserBotStatusRequest,
	AdminUserClearFieldsRequest,
	AdminUserCreateRequest,
	AdminUserCreateResponse,
	AdminUserDeletionCancelRequest,
	AdminUserDeletionScheduleRequest,
	AdminUserFlagsUpdateRequest,
	AdminUserGuildListQuery,
	AdminUserListQuery,
	AdminUserSystemStatusRequest,
	AdminUsersMeResponse,
	AdminUserTraitsRequest,
	AdminUserUsernameUpdateRequest,
	ListAppSessionsQuery,
	ListAppSessionsResponse,
	ListUserSessionsResponse,
	LookupUserRequest,
	LookupUserResponse,
	TerminateSessionsResponse,
	UserMutationResponse,
	UserRestrictionResponse,
} from '@osaca/schema/src/domains/admin/AdminUserSchemas';
import {
	AdminUserBanRequest,
	AdminUserFeatureLimitRequest,
	AdminUserWarningRequest,
	AdminUserWarningResponse,
} from '@osaca/schema/src/domains/admin/EnforcementSchemas';
import {UserIdParam} from '@osaca/schema/src/domains/common/CommonParamSchemas';

export function UserAdminController(app: HonoApp) {
	app.get(
		'/admin/acls',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.AUTHENTICATE),
		OpenAPI({
			operationId: 'list_admin_acls',
			summary: 'List admin permissions',
			responseSchema: AdminAclListResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Returns every access control permission the admin API recognises. This is the registry admin accounts and admin API keys draw their permissions from. Requires AUTHENTICATE permission.',
		}),
		async (ctx) => {
			const acls = Object.values(AdminACLs);
			await recordAdminRead(ctx, {
				targetType: 'admin_acl',
				targetId: 0n,
				action: AdminAuditReadActions.LIST_ADMIN_ACLS,
				metadata: {acl_count: acls.length},
			});
			return ctx.json({acls});
		},
	);
	app.get(
		'/admin/users/@me',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.AUTHENTICATE),
		OpenAPI({
			operationId: 'get_current_admin_user',
			summary: 'Get current admin',
			responseSchema: AdminUsersMeResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Return the admin the request was authenticated as, with the admin permissions, roles, and metadata of the account, plus the number of pending registrations when the admin holds REGISTRATION_REVIEW. Requires AUTHENTICATE permission.',
		}),
		async (ctx) => {
			const canReviewRegistrations = hasAdminACL(ctx.get('adminUserAcls'), AdminACLs.REGISTRATION_REVIEW);
			const [user, pendingRegistrations] = await Promise.all([
				mapUserToAdminResponse(ctx.get('user'), ctx.get('cacheService'), undefined, ctx.get('requestLocale')),
				canReviewRegistrations ? getInstanceConfigRepository().getPendingRegistrations() : null,
			]);
			return ctx.json({user, pending_registration_count: pendingRegistrations?.length ?? null});
		},
	);
	app.get(
		'/admin/users',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.USER_LOOKUP),
		Validator('query', AdminUserListQuery),
		OpenAPI({
			operationId: 'list_admin_users',
			summary: 'List users',
			responseSchema: SearchUsersResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lists and searches users. Exactly one selector is honoured, in this precedence order: user_id, resolve, last_active_ip, acl, then the indexed q search. The acl selector lists the users granted one admin permission, ordered by user ID. The resolve selector takes one exact identifier, a username or a user ID. The user_id selector ignores limit and offset. Requires USER_LOOKUP permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserAcls = ctx.get('adminUserAcls');
			const query = ctx.req.valid('query');
			let userIds: Array<string> | undefined;
			if (query.user_id !== undefined) {
				userIds = Array.isArray(query.user_id) ? query.user_id : [query.user_id];
			}
			if (userIds || query.resolve !== undefined) {
				const parsed = LookupUserRequest.safeParse(userIds ? {user_ids: userIds} : {query: query.resolve});
				if (!parsed.success) {
					throw inputValidationErrorFromZodIssues(parsed.error.issues);
				}
				const {users} = await adminService.userService.lookupService.lookupUser(
					parsed.data,
					adminUserAcls,
					ctx.get('requestLocale'),
				);
				await recordAdminRead(ctx, {
					targetType: 'user',
					targetId: 0n,
					action: AdminAuditReadActions.SEARCH_USERS,
					metadata: {
						selector: userIds ? 'user_id' : 'resolve',
						user_id: userIds?.length === 1 ? userIds[0] : undefined,
						user_id_count: userIds?.length,
						result_count: users.length,
						total: users.length,
					},
				});
				return ctx.json({users, total: users.length});
			}
			let selector: 'acl' | 'search' = 'search';
			if (query.acl !== undefined) {
				selector = 'acl';
			}
			const response = await adminService.searchService.searchUsers(
				{
					query: query.q,
					acl: selector === 'acl' ? query.acl : undefined,
					limit: query.limit,
					offset: query.offset,
				},
				adminUserAcls,
				ctx.get('requestLocale'),
			);
			await recordAdminRead(ctx, {
				targetType: 'user',
				targetId: 0n,
				action: AdminAuditReadActions.SEARCH_USERS,
				metadata: {
					selector,
					has_query: selector === 'search' && query.q?.trim() ? true : undefined,
					acl: selector === 'acl' ? query.acl : undefined,
					limit: query.limit,
					offset: query.offset,
					result_count: response.users.length,
					total: response.total,
				},
			});
			return ctx.json(response);
		},
	);
	app.post(
		'/admin/users',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.WILDCARD),
		Validator('json', AdminUserCreateRequest),
		OpenAPI({
			operationId: 'create_admin_user',
			summary: 'Create user',
			responseSchema: AdminUserCreateResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Create an account with no password and return a one-time password reset link for it. Hand the link to the new user, who opens it to choose a password. It works once and expires after an hour. Set admin to give the account full admin access. Creates audit log entries. Requires the * permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(
				await adminService.userService.creationService.createUser(
					ctx.req.valid('json'),
					ctx.get('adminUserId'),
					ctx.get('auditLogReason'),
					ctx.get('adminUserAcls'),
				),
			);
		},
	);
	app.get(
		'/admin/users/:user_id',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.USER_LOOKUP),
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'get_admin_user',
			summary: 'Get user',
			responseSchema: LookupUserResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Look up one detailed user profile by ID. Returns account status, permissions, and metadata. The IP address is redacted without the matching view permission. Requires USER_LOOKUP permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			const response = await adminService.userService.lookupService.lookupUser(
				{user_ids: [userId]},
				adminUserAcls,
				ctx.get('requestLocale'),
			);
			await recordAdminRead(ctx, {
				targetType: 'user',
				targetId: userId,
				action: AdminAuditReadActions.GET_USER,
				metadata: {found: response.users.length > 0},
			});
			return ctx.json(response);
		},
	);
	app.get(
		'/admin/users/:user_id/guilds',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.USER_LIST_GUILDS),
		Validator('param', UserIdParam),
		Validator('query', AdminUserGuildListQuery),
		OpenAPI({
			operationId: 'list_admin_user_guilds',
			summary: 'List user communities',
			responseSchema: ListUserGuildsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'List all guilds a user is a member of, optionally with approximate member and presence counts. Shows roles and join dates. Requires USER_LIST_GUILDS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const {user_id: userId} = ctx.req.valid('param');
			const query = ctx.req.valid('query');
			const response = await adminService.guildServiceAggregate.lookupService.listUserGuilds({
				user_id: userId,
				...query,
			});
			await recordAdminRead(ctx, {
				targetType: 'user',
				targetId: userId,
				action: AdminAuditReadActions.LIST_USER_GUILDS,
				metadata: {
					before_guild_id: query.before,
					after_guild_id: query.after,
					limit: query.limit,
					with_counts: query.with_counts,
					guild_count: response.guilds.length,
				},
			});
			return ctx.json(response);
		},
	);
	app.get(
		'/admin/users/:user_id/sessions',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_LIST_SESSIONS),
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'list_admin_user_sessions',
			summary: 'List user sessions',
			responseSchema: ListUserSessionsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'List all active user sessions across devices. Shows device info, IP, last activity, and creation time. Requires USER_LIST_SESSIONS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.securityService.listUserSessions(
					userId,
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);
	app.get(
		'/admin/app-sessions',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.USER_LIST_SESSIONS),
		Validator('query', ListAppSessionsQuery),
		OpenAPI({
			operationId: 'list_admin_app_sessions',
			summary: 'List native app sessions by platform and release channel',
			responseSchema: ListAppSessionsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lists active sessions whose native app last reported the given platform and release channel, with the app version, build number and beta number it reported. Pages hold up to 200 sessions and can hold fewer while next_cursor is still set. Requires USER_LIST_SESSIONS permission.',
		}),
		async (ctx) => {
			const query = ctx.req.valid('query');
			const result = await ctx.get('adminService').userService.securityService.listAppSessions(query);
			await recordAdminRead(ctx, {
				targetType: 'user',
				targetId: 0n,
				action: AdminAuditReadActions.LIST_APP_SESSIONS,
				metadata: {
					platform: query.platform,
					release_channel: query.release_channel,
					has_cursor: query.after !== undefined,
					result_count: result.sessions.length,
				},
			});
			return ctx.json(result);
		},
	);
	app.delete(
		'/admin/users/:user_id/sessions',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_FLAGS),
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'terminate_admin_user_sessions',
			summary: 'Terminate user sessions',
			responseSchema: TerminateSessionsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Terminate all active user sessions across devices. Forces user to re-authenticate on next connection. Creates audit log entry. Requires USER_UPDATE_FLAGS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.securityService.terminateSessions(
					{user_id: userId},
					adminUserId,
					auditLogReason,
				),
			);
		},
	);
	app.delete(
		'/admin/users/:user_id/profile-fields',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_PROFILE),
		Validator('param', UserIdParam),
		Validator('json', AdminUserClearFieldsRequest),
		OpenAPI({
			operationId: 'clear_admin_user_profile_fields',
			summary: 'Clear user profile fields',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Clears profile fields such as the bio, avatar or display name. An enforcement basis saves the old values as evidence, records a profile reset decision and sends its notice by system DM unless the instance has direct messages turned off. Creates audit log entry. Requires USER_UPDATE_PROFILE permission.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.userService.profileService.clearUserFields(
						createUserID(userId),
						ctx.req.valid('json'),
						enforcementActor(ctx),
					),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/bot-status',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_BOT_STATUS),
		Validator('param', UserIdParam),
		Validator('json', AdminUserBotStatusRequest),
		OpenAPI({
			operationId: 'set_admin_user_bot_status',
			summary: 'Set user bot status',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Mark or unmark a user account as a bot. Controls bot badge visibility and API permissions. Creates audit log entry. Requires USER_UPDATE_BOT_STATUS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.profileService.setUserBotStatus(
					{user_id: userId, ...ctx.req.valid('json')},
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/system-status',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_BOT_STATUS),
		Validator('param', UserIdParam),
		Validator('json', AdminUserSystemStatusRequest),
		OpenAPI({
			operationId: 'set_admin_user_system_status',
			summary: 'Set user system status',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Mark or unmark a user as a system account. System accounts have special permissions for automated operations. Creates audit log entry. Requires USER_UPDATE_BOT_STATUS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.profileService.setUserSystemStatus(
					{user_id: userId, ...ctx.req.valid('json')},
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);
	app.patch(
		'/admin/users/:user_id/username',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_USERNAME),
		Validator('param', UserIdParam),
		Validator('json', AdminUserUsernameUpdateRequest),
		OpenAPI({
			operationId: 'update_admin_user_username',
			summary: 'Change user username',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Change user username. New username must meet requirements and be unique. Creates audit log entry. Requires USER_UPDATE_USERNAME permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.profileService.changeUsername(
					{user_id: userId, ...ctx.req.valid('json')},
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);

	app.post(
		'/admin/users/:user_id/sign-in-link',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.WILDCARD),
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'create_admin_user_sign_in_link',
			summary: 'Create admin sign-in link',
			responseSchema: AdminSignInLinkResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Create a one-time sign-in link for an account that holds `*`. Opening the link signs that account in and authorizes the IP address of the browser, without a password. It works once and expires after 15 minutes. Only served on the operator socket. Creates audit log entry, and using the link creates another.',
		}),
		async (ctx) => {
			if (ctx.get('authTokenType') !== 'operator') {
				throw new AccessDeniedError();
			}
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await createSignInLink(ctx.get('apiContext'), ctx.get('adminService').auditService, {
					userId: createUserID(userId),
					adminUserId: ctx.get('adminUserId'),
					auditLogReason: ctx.get('auditLogReason'),
				}),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/ban',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_TEMP_BAN),
		Validator('param', UserIdParam),
		Validator('json', AdminUserBanRequest),
		OpenAPI({
			operationId: 'ban_admin_user',
			summary: 'Suspend user',
			responseSchema: UserRestrictionResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Suspend the account for duration_hours, or permanently with a duration of zero, and record the enforcement decision behind it. The decision is written first, then the suspension, then linked reports are resolved and the notice is sent. The X-Audit-Log-Reason header is required and becomes the first note. remove_evidence queues removal of the reported messages and the evidence you listed after they are snapshotted, and keeps the other messages from the reports. block_networks blocks addresses the account used in the last 30 days, for 90 days unless days says otherwise, and only with a permanent suspension. Exempt and special-purpose addresses, and addresses already blocked permanently or by another decision, are skipped and listed in skipped_ips. An address on which another account that is not suspended or closed was last active is refused with ENFORCEMENT_NETWORK_SHARED. Returns 409 when the account is closed. Requires USER_TEMP_BAN permission, plus MESSAGE_LOOKUP for evidence, REPORT_VIEW and REPORT_RESOLVE for reports, MESSAGE_SHRED for remove_evidence, and BAN_IP_ADD and USER_VIEW_IP for block_networks.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.banService.tempBanUser(createUserID(userId), ctx.req.valid('json'), enforcementActor(ctx)),
			);
		},
	);
	app.delete(
		'/admin/users/:user_id/ban',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_TEMP_BAN),
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'unban_admin_user',
			summary: 'Lift a suspension without a decision',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lift a suspension that no enforcement decision owns, such as one from before decisions existed. Returns 409 with the decision ID when a decision owns the suspension, which is then ended through its end route. Tells the user by system DM that the restriction ended when the suspension was still in force. Creates audit log entry. Requires USER_TEMP_BAN permission.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(await ctx.get('adminService').banService.unbanUser(createUserID(userId), enforcementActor(ctx)));
		},
	);
	app.post(
		'/admin/users/:user_id/warnings',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_FLAGS),
		Validator('param', UserIdParam),
		Validator('json', AdminUserWarningRequest),
		OpenAPI({
			operationId: 'warn_admin_user',
			summary: 'Warn user',
			responseSchema: AdminUserWarningResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Record a warning decision and send its notice by system DM unless the instance has direct messages turned off. Nothing about the account changes. The X-Audit-Log-Reason header is required and becomes the first note. Refused for reasons that only allow a suspension or content removal. Requires USER_UPDATE_FLAGS permission, plus MESSAGE_LOOKUP for evidence and REPORT_VIEW and REPORT_RESOLVE for reports.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.banService.warnUser(createUserID(userId), ctx.req.valid('json'), enforcementActor(ctx)),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/feature-limits',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_FLAGS),
		Validator('param', UserIdParam),
		Validator('json', AdminUserFeatureLimitRequest),
		OpenAPI({
			operationId: 'limit_admin_user_features',
			summary: 'Limit user features',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Record an enforcement decision that limits one feature and send its notice by system DM unless the instance has direct messages turned off. Direct messages set SPAMMER and are allowed for spam, automation, fraud and malware reasons only. Reports set REPORT_BANNED until ends_at, 90 days by default and at most 365, and expire on their own. Purchases set PURCHASE_DISABLED for payment reasons. The X-Audit-Log-Reason header is required and becomes the first note. Requires USER_UPDATE_FLAGS permission, plus MESSAGE_LOOKUP for evidence and REPORT_VIEW and REPORT_RESOLVE for reports.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.banService.limitFeatures(createUserID(userId), ctx.req.valid('json'), enforcementActor(ctx)),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/deletion',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_DELETE),
		Validator('param', UserIdParam),
		Validator('json', AdminUserDeletionScheduleRequest),
		OpenAPI({
			operationId: 'schedule_admin_user_deletion',
			summary: 'Schedule user deletion',
			responseSchema: UserRestrictionResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Close the account and schedule its deletion. The basis says why. A broken rule records an enforcement decision kind closure, keeps the account for at least 74 days so an appeal can be reviewed first (14 days on a self-hosted instance, which has no appeals), sends the notice. The X-Audit-Log-Reason header is then required and becomes the first note. A holder request or housekeeping keeps the account for at least 14 days, sends a neutral email, and is cancelled when the holder signs in. Those two return 409 while an enforcement decision owns the account state. When a deletion is already scheduled, the request must name it in replace_pending_deletion_at or it returns 409. block_networks works as on the suspend route and is refused for the other bases. Executing the deletion removes the blocks. Creates audit log entry. Requires USER_DELETE permission, plus MESSAGE_LOOKUP for evidence, REPORT_VIEW and REPORT_RESOLVE for reports, MESSAGE_SHRED for remove_evidence, and BAN_IP_ADD and USER_VIEW_IP for block_networks.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.userService.deletionService.scheduleAccountDeletion(
						createUserID(userId),
						ctx.req.valid('json'),
						enforcementActor(ctx),
					),
			);
		},
	);
	app.delete(
		'/admin/users/:user_id/deletion',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_DELETE),
		Validator('param', UserIdParam),
		Validator('json', AdminUserDeletionCancelRequest),
		OpenAPI({
			operationId: 'cancel_admin_user_deletion',
			summary: 'Cancel user deletion',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Cancel a scheduled deletion that no enforcement decision owns, named by expected_pending_deletion_at, such as one the holder asked for or a closure from before decisions existed. Returns 409 with the decision ID when a decision owns the deletion, which is then ended through its end route, 409 when a different deletion is pending and 400 when none is. Tells the user by system DM that the restriction ended for a closure from before decisions existed. Creates audit log entry recording the cancelled deletion. Requires USER_DELETE permission.',
		}),
		async (ctx) => {
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.userService.deletionService.cancelAccountDeletion(
						createUserID(userId),
						ctx.req.valid('json'),
						enforcementActor(ctx),
					),
			);
		},
	);
	app.delete(
		'/admin/users/:user_id/message-deletion',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_CANCEL_BULK_MESSAGE_DELETION),
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'cancel_admin_user_message_deletion',
			summary: 'Cancel bulk message deletion',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Cancel a scheduled bulk message deletion job for a user. Prevents deletion of user messages across guilds. Creates audit log entry. Requires USER_CANCEL_BULK_MESSAGE_DELETION permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.cancelBulkMessageDeletion(
					{user_id: userId},
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/acls',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.ACL_SET_USER),
		Validator('param', UserIdParam),
		Validator('json', AdminUserAclsRequest),
		OpenAPI({
			operationId: 'set_admin_user_acls',
			summary: 'Set user admin permissions',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Replace the admin ACL permissions granted to a user. Controls admin capabilities and panel access. The permissions accepted are the ones listed by GET /admin/acls. Creates audit log entry. Requires ACL_SET_USER permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			return ctx.json(
				await adminService.userService.securityService.setUserAcls(
					{user_id: userId, ...ctx.req.valid('json')},
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);
	app.put(
		'/admin/users/:user_id/traits',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_TRAITS),
		Validator('param', UserIdParam),
		Validator('json', AdminUserTraitsRequest),
		OpenAPI({
			operationId: 'set_admin_user_traits',
			summary: 'Set user traits',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Set or update user trait attributes and profile metadata. Traits customize user display and features. Trait names are stored in lowercase, and limit rules match them without regard to case. Creates audit log entry. Requires USER_UPDATE_TRAITS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const {user_id: userId} = ctx.req.valid('param');
			const {traits} = ctx.req.valid('json');
			return ctx.json(
				await adminService.userService.securityService.setUserTraits(
					{user_id: userId, traits: [...new Set(traits.map((trait) => trait.toLowerCase()))]},
					adminUserId,
					auditLogReason,
					adminUserAcls,
				),
			);
		},
	);
	app.patch(
		'/admin/users/:user_id/flags',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.USER_UPDATE_FLAGS),
		Validator('param', UserIdParam),
		Validator('json', AdminUserFlagsUpdateRequest),
		OpenAPI({
			operationId: 'update_admin_user_flags',
			summary: 'Update user flags',
			responseSchema: UserMutationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Add or remove user flags. Flags that record a restriction go through their own routes: adding DISABLED, DELETED, SPAMMER or REPORT_BANNED and removing DELETED return 400, removing DISABLED while a suspension is set returns 400, and removing SPAMMER or REPORT_BANNED while an enforcement decision holds it returns 409 with the decision ID. A self-disabled account can still have DISABLED removed. Creates audit log entry. Requires USER_UPDATE_FLAGS permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const adminUserAcls = ctx.get('adminUserAcls');
			const body = ctx.req.valid('json');
			const userId = createUserID(ctx.req.valid('param').user_id);
			const addFlags = body.add_flags.map((flag) => BigInt(flag));
			const removeFlags = body.remove_flags.map((flag) => BigInt(flag));
			return ctx.json(
				await adminService.userService.securityService.updateUserFlags({
					userId,
					data: {addFlags, removeFlags},
					adminUserId,
					auditLogReason,
					acls: adminUserAcls,
				}),
			);
		},
	);
}
