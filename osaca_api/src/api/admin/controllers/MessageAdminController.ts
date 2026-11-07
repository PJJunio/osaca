// SPDX-License-Identifier: AGPL-3.0-or-later

import {AdminAuditReadActions} from '@app/api/admin/AdminAuditActions';
import {recordAdminRead, recordAdminWrite} from '@app/api/admin/AdminAuditRecorder';
import {createChannelID, createMessageID, createUserID} from '@app/api/BrandedTypes';
import {enforcementActor} from '@app/api/enforcement/EnforcementActor';
import {requireAdminACL} from '@app/api/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {
	AdminMessageDeleteRequest,
	AdminUserMessageDeleteQuery,
	AdminUserMessageDeleteRequest,
	AdminUserMessageShredPreviewRequest,
	AdminUserMessageShredRequest,
	DeleteAllUserMessagesResponse,
	MessageShredJobIdParam,
	MessageShredPreviewResponse,
	MessageShredResponse,
} from '@osaca/schema/src/domains/admin/AdminMessageSchemas';
import {DeleteMessageResponse, MessageShredStatusResponse} from '@osaca/schema/src/domains/admin/AdminSchemas';
import {ChannelIdMessageIdParam, UserIdParam} from '@osaca/schema/src/domains/common/CommonParamSchemas';

export function MessageAdminController(app: HonoApp) {
	app.get(
		'/admin/messages/shreds/:job_id',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_SHRED),
		Validator('param', MessageShredJobIdParam),
		OpenAPI({
			operationId: 'get_admin_message_shred',
			summary: 'Get message shred job',
			description:
				'Returns the progress of a queued message shred job, including whether it is complete. Requires MESSAGE_SHRED permission.',
			responseSchema: MessageShredStatusResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const {job_id} = ctx.req.valid('param');
			const response = await adminService.messageShredService.getMessageShredStatus(job_id.toString());
			await recordAdminRead(ctx, {
				targetType: 'message_shred',
				targetId: 0n,
				action: AdminAuditReadActions.GET_MESSAGE_SHRED_STATUS,
				metadata: {job_id, status: response.status},
			});
			return ctx.json(response);
		},
	);
	app.delete(
		'/admin/channels/:channel_id/messages/:message_id',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_DELETE),
		Validator('param', ChannelIdMessageIdParam),
		Validator('json', AdminMessageDeleteRequest),
		OpenAPI({
			operationId: 'delete_admin_message',
			summary: 'Delete message',
			description:
				'Deletes one message from a channel, with its attachments. The basis is holder_request or housekeeping, such as cleanup of webhook or system messages. To remove a message for breaking a rule, shred it with an enforcement basis so a decision records it. Logged to audit log with the basis. Requires MESSAGE_DELETE permission.',
			responseSchema: DeleteMessageResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const {channel_id, message_id} = ctx.req.valid('param');
			return ctx.json(
				await adminService.messageService.deleteMessage(
					createChannelID(channel_id),
					createMessageID(message_id),
					ctx.req.valid('json'),
					adminUserId,
					auditLogReason,
				),
			);
		},
	);
	app.post(
		'/admin/users/:user_id/message-shreds/preview',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_SHRED),
		Validator('param', UserIdParam),
		Validator('json', AdminUserMessageShredPreviewRequest),
		OpenAPI({
			operationId: 'preview_admin_user_message_shred',
			summary: 'Preview a message shred',
			description:
				'Lists exactly the messages a shred of these entries removes: entries the user sent in that channel. Entries that are missing, sent by someone else or listed twice are returned in skipped and are never removed. Pass preview_token with the shred to remove exactly these messages. Nothing is removed and no decision is recorded. Requires MESSAGE_SHRED permission.',
			responseSchema: MessageShredPreviewResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const {user_id} = ctx.req.valid('param');
			const body = ctx.req.valid('json');
			const preview = await ctx
				.get('adminService')
				.messageShredService.previewMessageShred(createUserID(user_id), body);
			await recordAdminWrite(ctx, {
				targetType: 'message_shred',
				targetId: user_id,
				action: 'preview_message_shred',
				metadata: {
					user_id,
					requested_entries: body.entries.length,
					message_count: preview.message_count,
					skipped_entries: preview.skipped.length,
				},
			});
			return ctx.json(preview);
		},
	);
	app.post(
		'/admin/users/:user_id/message-shreds',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_SHRED),
		Validator('param', UserIdParam),
		Validator('json', AdminUserMessageShredRequest),
		OpenAPI({
			operationId: 'shred_admin_user_messages',
			summary: 'Shred user messages',
			description:
				'Queues bulk shredding of the given messages of a user, with attachment deletion. Only messages the user sent in the named channel are removed. With preview_token from the preview route, exactly the previewed messages are removed, and the request is refused with MESSAGE_SHRED_PREVIEW_CHANGED when they changed since. Returns a job ID to track progress asynchronously. With an enforcement basis the first 50 entries are snapshotted as the evidence of a content removal decision before the job is queued, every entry for child safety and violent extremism reasons, and the user is sent its notice. Requires MESSAGE_SHRED permission.',
			responseSchema: MessageShredResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const {user_id} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.messageShredService.queueMessageShred(createUserID(user_id), ctx.req.valid('json'), enforcementActor(ctx)),
			);
		},
	);
	app.delete(
		'/admin/users/:user_id/messages',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_DELETE_ALL),
		Validator('param', UserIdParam),
		Validator('query', AdminUserMessageDeleteQuery),
		Validator('json', AdminUserMessageDeleteRequest),
		OpenAPI({
			operationId: 'delete_admin_user_messages',
			summary: 'Delete all user messages',
			description:
				'Deletes all messages from a specific user across all channels. Pass dry_run=false to delete, with a basis in the body. The default counts without deleting and records nothing. An enforcement basis records a content removal decision and sends its notice, and is refused for child safety and violent extremism reasons, which must shred explicit entries instead. Requires MESSAGE_DELETE_ALL permission.',
			responseSchema: DeleteAllUserMessagesResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const {user_id} = ctx.req.valid('param');
			return ctx.json(
				await ctx
					.get('adminService')
					.messageDeletionService.deleteAllUserMessages(
						createUserID(user_id),
						{dryRun: ctx.req.valid('query').dry_run, basis: ctx.req.valid('json').basis},
						enforcementActor(ctx),
					),
			);
		},
	);
}
