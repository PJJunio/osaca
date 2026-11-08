// SPDX-License-Identifier: AGPL-3.0-or-later

import {mlsClientManager} from '@app/features/crypto/MlsClientManager';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import GuildReadState from '@app/features/guild/state/GuildReadState';
import GuildMembers from '@app/features/member/state/GuildMembers';
import MessageReferences from '@app/features/messaging/state/MessageReferences';
import Messages from '@app/features/messaging/state/MessagingMessages';
import MentionFeed from '@app/features/notification/state/MentionFeed';
import ReadStates from '@app/features/read_state/state/ReadStates';
import ChannelThreads from '@app/features/threads/state/ChannelThreads';
import RollingTypingStore from '@app/features/typing/rolling/RollingTypingStore';
import Notification from '@app/features/ui/state/Notification';
import CallState from '@app/features/voice/state/CallState';
import TtsUtils from '@app/features/voice/utils/VoiceTtsUtils';
import type {GuildMemberData} from '@osaca/schema/src/domains/guild/GuildMemberSchemas';
import type {Message} from '@osaca/schema/src/domains/message/MessageResponseSchemas';

function dispatchIncomingMessage(data: Message): void {
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
					(data as {content: string}).content = decrypted;
				}
			} catch {
				// Decryption failed or out-of-order epoch
			}
			dispatchIncomingMessage(data);
		})();
		return;
	}
	dispatchIncomingMessage(data);
}
