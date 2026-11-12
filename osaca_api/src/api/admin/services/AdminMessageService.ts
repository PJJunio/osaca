// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import {type ChannelID, createUserID, type MessageID, type UserID} from '@app/api/BrandedTypes';
import type {ChannelRepository} from '@app/api/channel/ChannelRepository';
import {withThreadContext} from '@app/api/channel/services/ChannelGatewayDispatch';
import {
	enqueueCrosspostFamilyPurgeFromCopies,
	enqueueCrosspostSourceRemoval,
} from '@app/api/channel/services/message/CrosspostPropagation';
import {decrementThreadMessageCount, purgeMessageAttachments} from '@app/api/channel/services/message/MessageHelpers';
import type {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import {getPurgeQueue, getStorageService} from '@app/api/middleware/ServiceSingletons';
import {deleteMessageSearchDocuments} from '@app/api/search/MessageSearchIndexCleanup';
import type {AdminMessageDeleteRequest} from '@osaca/schema/src/domains/admin/AdminMessageSchemas';

interface AdminMessageServiceDeps {
	apiContext: ApiContext;
	channelRepository: ChannelRepository;
	guildRepository: GuildRepository;
	auditService: AdminAuditService;
}

export class AdminMessageService {
	constructor(private readonly deps: AdminMessageServiceDeps) {}

	async deleteMessage(
		channelId: ChannelID,
		messageId: MessageID,
		{basis}: AdminMessageDeleteRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
	) {
		const {channelRepository, auditService} = this.deps;
		const {gateway: gatewayService, worker: workerService} = this.deps.apiContext.services;
		const channel = await channelRepository.channelData.findUnique(channelId);
		const message = await channelRepository.messages.getMessage(channelId, messageId);
		if (message) {
			await purgeMessageAttachments(message, getStorageService(), getPurgeQueue());
			await channelRepository.messages.deleteMessage(
				channelId,
				messageId,
				message.authorId || createUserID(0n),
				message.pinnedTimestamp || undefined,
			);
			await decrementThreadMessageCount(channelRepository, channel, [messageId]);
			if (channel) {
				if (channel.guildId) {
					await gatewayService.dispatchGuild({
						guildId: channel.guildId,
						event: 'MESSAGE_DELETE',
						data: withThreadContext(channel, {
							channel_id: channelId.toString(),
							id: messageId.toString(),
						}),
					});
				} else {
					for (const recipientId of channel.recipientIds) {
						await gatewayService.dispatchPresence({
							userId: recipientId,
							event: 'MESSAGE_DELETE',
							data: {
								channel_id: channelId.toString(),
								id: messageId.toString(),
							},
						});
					}
				}
			}
			await deleteMessageSearchDocuments([messageId], {context: {source: 'admin_message_delete'}});
			await enqueueCrosspostSourceRemoval(workerService, {messages: [message], mode: 'purge'});
			await enqueueCrosspostFamilyPurgeFromCopies(workerService, {messages: [message]});
		}
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'message',
			targetId: BigInt(messageId),
			action: 'delete_message',
			auditLogReason,
			metadata: new Map([
				['channel_id', channelId.toString()],
				['message_id', messageId.toString()],
				['basis', basis.type],
			]),
		});
		return {
			success: true,
		};
	}
}
