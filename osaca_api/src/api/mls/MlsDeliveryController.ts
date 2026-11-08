// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createMessageID} from '@app/api/BrandedTypes';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {getGatewayService, getMlsDeliveryService} from '@app/api/middleware/ServiceRegistry';
import {getChannelRepository} from '@app/api/middleware/ServiceSingletons';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {MlsGroupNotFoundError} from '@osaca/errors/src/domains/mls/MlsGroupNotFoundError';
import {
	MlsCiphertextHistoryQuery,
	MlsCiphertextHistoryResponse,
	MlsCiphertextMessageRequest,
	MlsCiphertextMessageResponse,
	MlsClaimKeyPackageResponse,
	MlsCommitDetailResponse,
	MlsCommitRequest,
	MlsCommitResponse,
	MlsCreateGroupRequest,
	MlsGroupResponse,
	MlsKeyPackagesPublishRequest,
	MlsKeyPackagesPublishResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';
import {z} from 'zod';

const DeviceIdParam = z.object({
	device_id: z.string().min(1).describe('Target device identifier'),
});

const GroupIdParam = z.object({
	group_id: z.string().min(1).describe('MLS group identifier'),
});

const GroupIdEpochParam = z.object({
	group_id: z.string().min(1).describe('MLS group identifier'),
	epoch: z.coerce.number().int().nonnegative().describe('MLS epoch number'),
});

export function MlsDeliveryController(app: HonoApp): void {
	app.post(
		'/mls/key-packages',
		LoginRequired,
		Validator('json', MlsKeyPackagesPublishRequest),
		OpenAPI({
			operationId: 'mls_publish_key_packages',
			summary: 'Publish device KeyPackages',
			responseSchema: MlsKeyPackagesPublishResponse,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Publishes a batch of pre-generated MLS KeyPackages for a device.',
		}),
		async (ctx) => {
			const {device_id, key_packages} = ctx.req.valid('json');
			const service = getMlsDeliveryService();
			const published = await service.publishKeyPackages(device_id, key_packages);
			return ctx.json({published}, 201);
		},
	);

	app.post(
		'/mls/devices/:device_id/claim-key-package',
		LoginRequired,
		Validator('param', DeviceIdParam),
		OpenAPI({
			operationId: 'mls_claim_key_package',
			summary: 'Claim a device KeyPackage',
			responseSchema: MlsClaimKeyPackageResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Atomically claims and consumes a single pre-published KeyPackage for a device.',
		}),
		async (ctx) => {
			const {device_id} = ctx.req.valid('param');
			const service = getMlsDeliveryService();
			const keyPackage = await service.claimKeyPackage(device_id);
			return ctx.json({key_package: keyPackage}, 200);
		},
	);

	app.post(
		'/mls/groups',
		LoginRequired,
		Validator('json', MlsCreateGroupRequest),
		OpenAPI({
			operationId: 'mls_create_group',
			summary: 'Create or register an MLS group',
			responseSchema: MlsGroupResponse,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Registers or updates MLS group metadata including epoch and disappearing message TTL.',
		}),
		async (ctx) => {
			const {group_id, disappearing_ttl_seconds} = ctx.req.valid('json');
			const service = getMlsDeliveryService();
			const group = await service.createGroup(group_id, disappearing_ttl_seconds);
			return ctx.json(group, 201);
		},
	);

	app.get(
		'/mls/groups/:group_id',
		LoginRequired,
		Validator('param', GroupIdParam),
		OpenAPI({
			operationId: 'mls_get_group',
			summary: 'Get MLS group metadata',
			responseSchema: MlsGroupResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Fetches the current MLS group metadata and epoch.',
		}),
		async (ctx) => {
			const {group_id} = ctx.req.valid('param');
			const service = getMlsDeliveryService();
			const group = await service.getGroup(group_id);
			if (!group) {
				throw new MlsGroupNotFoundError(group_id);
			}
			return ctx.json(group, 200);
		},
	);

	app.post(
		'/mls/groups/:group_id/commits',
		LoginRequired,
		Validator('param', GroupIdParam),
		Validator('json', MlsCommitRequest),
		OpenAPI({
			operationId: 'mls_post_commit',
			summary: 'Post an MLS Commit',
			responseSchema: MlsCommitResponse,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Advances the group to a new epoch by applying an MLS commit. Returns HTTP 409 on epoch conflict.',
		}),
		async (ctx) => {
			const {group_id} = ctx.req.valid('param');
			const {epoch, commit, welcome} = ctx.req.valid('json');
			const service = getMlsDeliveryService();
			const result = await service.postCommit(group_id, epoch, commit, welcome);
			return ctx.json(result, 201);
		},
	);

	app.get(
		'/mls/groups/:group_id/commits/:epoch',
		LoginRequired,
		Validator('param', GroupIdEpochParam),
		OpenAPI({
			operationId: 'mls_get_commit',
			summary: 'Get an MLS Commit for an epoch',
			responseSchema: MlsCommitDetailResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Retrieves the commit message blob for a specific epoch.',
		}),
		async (ctx) => {
			const {group_id, epoch} = ctx.req.valid('param');
			const service = getMlsDeliveryService();
			const commit = await service.getCommit(group_id, epoch);
			if (!commit) {
				throw new MlsGroupNotFoundError(group_id);
			}
			return ctx.json(commit, 200);
		},
	);

	app.get(
		'/mls/groups/:group_id/welcomes/:epoch',
		LoginRequired,
		Validator('param', GroupIdEpochParam),
		OpenAPI({
			operationId: 'mls_get_welcome',
			summary: 'Get an MLS Welcome for an epoch',
			responseSchema: MlsWelcomeDetailResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Retrieves the welcome message blob for a specific epoch.',
		}),
		async (ctx) => {
			const {group_id, epoch} = ctx.req.valid('param');
			const service = getMlsDeliveryService();
			const welcome = await service.getWelcome(group_id, epoch);
			if (!welcome) {
				throw new MlsGroupNotFoundError(group_id);
			}
			return ctx.json(welcome, 200);
		},
	);

	app.post(
		'/mls/groups/:group_id/messages',
		LoginRequired,
		Validator('param', GroupIdParam),
		Validator('json', MlsCiphertextMessageRequest),
		OpenAPI({
			operationId: 'mls_post_ciphertext',
			summary: 'Post ciphertext message',
			responseSchema: MlsCiphertextMessageResponse,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description: 'Stores opaque ciphertext and dispatches gateway event to participants.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {group_id} = ctx.req.valid('param');
			const {epoch, message_id, ciphertext} = ctx.req.valid('json');
			const service = getMlsDeliveryService();
			const result = await service.postCiphertext(group_id, epoch, message_id, ciphertext);
			const gateway = getGatewayService();
			const channelRepo = getChannelRepository();
			let channel = null;
			try {
				channel = await channelRepo.channelData.findUnique(createChannelID(BigInt(group_id)));
			} catch {}

			if (channel) {
				try {
					await channelRepo.channelData.updateLastMessageId(channel.id, createMessageID(BigInt(message_id)), {
						isInsert: true,
					});
				} catch {}
			}

			const authorData = {
				id: user.id.toString(),
				username: user.username,
				discriminator: user.discriminator,
				avatar: user.avatarHash,
			};

			if (channel?.recipientIds && channel.recipientIds.size > 0) {
				await Promise.all(
					Array.from(channel.recipientIds).map((recipientId) =>
						gateway.dispatchPresence({
							userId: recipientId,
							event: 'MESSAGE_CREATE',
							data: {
								id: message_id,
								channel_id: group_id,
								epoch,
								ciphertext,
								created_at: result.created_at,
								expires_at: result.expires_at,
								author: authorData,
							},
						}),
					),
				);
			} else {
				await gateway.dispatchPresence({
					userId: user.id,
					event: 'MESSAGE_CREATE',
					data: {
						id: message_id,
						channel_id: group_id,
						epoch,
						ciphertext,
						created_at: result.created_at,
						expires_at: result.expires_at,
						author: authorData,
					},
				});
			}
			return ctx.json(result, 201);
		},
	);

	app.get(
		'/mls/groups/:group_id/messages',
		LoginRequired,
		Validator('param', GroupIdParam),
		Validator('query', MlsCiphertextHistoryQuery),
		OpenAPI({
			operationId: 'mls_get_ciphertext_history',
			summary: 'Get ciphertext message history',
			responseSchema: MlsCiphertextHistoryResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['MLS', 'DeliveryService'],
			description:
				'Retrieves paginated ciphertext history respecting the ADR-0012 v1 member join epoch boundary and disappearing message TTL.',
		}),
		async (ctx) => {
			const {group_id} = ctx.req.valid('param');
			const {member_join_epoch, before, limit} = ctx.req.valid('query');
			const service = getMlsDeliveryService();
			const messages = await service.getCiphertextHistory(group_id, member_join_epoch, before, limit);
			return ctx.json({messages}, 200);
		},
	);
}
