// SPDX-License-Identifier: AGPL-3.0-or-later

import {mlsClientManager} from '@app/features/crypto/MlsClientManager';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import GuildReadState from '@app/features/guild/state/GuildReadState';
import GuildMembers from '@app/features/member/state/GuildMembers';
import {handleMessageDelete} from '@app/features/messaging/events/MessageDelete';
import {handleMessageReactionAdd} from '@app/features/messaging/events/MessageReactionAdd';
import {handleMessageReactionRemove} from '@app/features/messaging/events/MessageReactionRemove';
import {handleMessageUpdate} from '@app/features/messaging/events/MessageUpdate';
import MessageReferences from '@app/features/messaging/state/MessageReferences';
import Messages from '@app/features/messaging/state/MessagingMessages';
import {hydrateDecryptedChatMessage} from '@app/features/messaging/utils/HydrateDecryptedMessage';
import MentionFeed from '@app/features/notification/state/MentionFeed';
import ReadStates from '@app/features/read_state/state/ReadStates';
import {localMessageSearchIndex} from '@app/features/search/state/LocalMessageSearchIndex';
import ChannelThreads from '@app/features/threads/state/ChannelThreads';
import RollingTypingStore from '@app/features/typing/rolling/RollingTypingStore';
import Notification from '@app/features/ui/state/Notification';
import CallState from '@app/features/voice/state/CallState';
import TtsUtils from '@app/features/voice/utils/VoiceTtsUtils';
import type {GuildMemberData} from '@osaca/schema/src/domains/guild/GuildMemberSchemas';
import type {Message} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import {parseMlsApplicationPayload} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';

function normalizeIncomingMessage(data: Message): void {
	if (!data.timestamp && (data as unknown as {created_at?: string}).created_at) {
		data.timestamp = (data as unknown as {created_at: string}).created_at;
	}
	if (!data.timestamp) {
		data.timestamp = new Date().toISOString();
	}
	if (!data.mentions) data.mentions = [];
	if (!data.mention_roles) data.mention_roles = [];
	if (!data.attachments) data.attachments = [];
	if (!data.embeds) data.embeds = [];
	if (!data.reactions) data.reactions = [];
	if (data.type === undefined) (data as unknown as {type: number}).type = 0;
	if (data.flags === undefined) data.flags = 0;
	if (data.pinned === undefined) data.pinned = false;
	if (data.mention_everyone === undefined) data.mention_everyone = false;
	if (data.tts === undefined) data.tts = false;
	if (data.content === undefined) data.content = '';
	if (data.author) {
		if (data.author.global_name === undefined) data.author.global_name = null;
		if (data.author.discriminator === undefined) data.author.discriminator = '0000';
	}
}

function dispatchIncomingMessage(data: Message): void {
	normalizeIncomingMessage(data);
	if (data.guild_id && data.member) {
		GuildMembers.hydrateIfMissing(data.guild_id, {
			...data.member,
			user: data.author,
		} as GuildMemberData);
	}
	if (data.mentions && data.guild_id) {
		for (const mention of data.mentions) {
			if (mention.member) {
				GuildMembers.hydrateIfMissing(data.guild_id, {
					...mention.member,
					user: mention,
				} as GuildMemberData);
			}
		}
	}
	if (data.thread !== undefined) {
		ChannelThreads.ingestMessageThreads([data]);
	}
	RollingTypingStore.remove(data.channel_id, data.author.id);
	Messages.handleIncomingMessage({channelId: data.channel_id, message: data});
	MessageReferences.handleMessageCreate(data, false);
	Notification.handleMessageCreate({message: data});
	ReadStates.handleIncomingMessage({channelId: data.channel_id, message: data});
	GuildReadState.handleGenericUpdate(data.channel_id);
	MentionFeed.handleMessageCreate(data);
	TtsUtils.handleIncomingTtsMessage(data);
	if (data.call && data.channel_id) {
		CallState.handleCallParticipants(data.channel_id, [...data.call.participants]);
	}
}

export function handleMessageCreate(data: Message, _context: GatewayHandlerContext): void {
	const rawCiphertext = (data as unknown as {ciphertext?: string}).ciphertext;
	if (rawCiphertext) {
		void (async () => {
			try {
				const decrypted = await mlsClientManager.decryptMessage(data.channel_id, rawCiphertext);
				if (decrypted) {
					const appPayload = parseMlsApplicationPayload(decrypted);
					switch (appPayload.type) {
						case 'chat_message': {
							hydrateDecryptedChatMessage(data, appPayload);
							dispatchIncomingMessage(data);
							return;
						}
						case 'message_edit': {
							localMessageSearchIndex.updateMessage(data.channel_id, appPayload.target_message_id, {
								content: appPayload.content,
								edited_timestamp: data.timestamp ?? new Date().toISOString(),
							});
							handleMessageUpdate(
								{
									id: appPayload.target_message_id,
									channel_id: data.channel_id,
									content: appPayload.content,
									edited_timestamp: data.timestamp ?? new Date().toISOString(),
								} as unknown as Message,
								_context,
							);
							return;
						}
						case 'message_delete': {
							localMessageSearchIndex.removeMessage(data.channel_id, appPayload.target_message_id);
							handleMessageDelete(
								{
									id: appPayload.target_message_id,
									channel_id: data.channel_id,
								},
								_context,
							);
							return;
						}
						case 'reaction_add': {
							handleMessageReactionAdd(
								{
									user_id: appPayload.user_id,
									channel_id: data.channel_id,
									message_id: appPayload.target_message_id,
									emoji: appPayload.emoji,
								},
								_context,
							);
							return;
						}
						case 'reaction_remove': {
							handleMessageReactionRemove(
								{
									user_id: appPayload.user_id,
									channel_id: data.channel_id,
									message_id: appPayload.target_message_id,
									emoji: appPayload.emoji,
								},
								_context,
							);
							return;
						}
					}
				}
			} catch {
				// Decryption failed or out-of-order epoch
			}
			// If decryption returned empty (e.g. self-sent MLS message), recover optimistic content
			const existing =
				(data.nonce ? Messages.getMessage(data.channel_id, data.nonce) : null) ??
				Messages.getMessage(data.channel_id, data.id);
			if (existing && existing.content && (!data.content || data.content.length === 0)) {
				data.content = existing.content;
			}
			dispatchIncomingMessage(data);
		})();
		return;
	}
	dispatchIncomingMessage(data);
}
