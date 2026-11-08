// SPDX-License-Identifier: AGPL-3.0-or-later

import Channels from '@app/features/channel/state/Channels';
import Guilds from '@app/features/guild/state/Guilds';
import {downloadTextFile} from '@app/features/platform/utils/DownloadFile';
import {type LocalIndexedMessage, localMessageSearchIndex} from '@app/features/search/state/LocalMessageSearchIndex';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import Users from '@app/features/user/state/Users';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export const EXPORT_READY_DESCRIPTOR = msg({
	message: 'Your data export is ready and downloading.',
	comment: 'Toast message announcing that the client-side data export has been downloaded.',
});

export interface ClientExportAccount {
	id: string;
	username: string;
	discriminator: number | string;
	email?: string | null;
	phone?: string | null;
	bio?: string | null;
	avatar?: string | null;
	created_at?: string | null;
	flags?: number;
}

export interface ClientExportGuild {
	id: string;
	name: string;
	icon?: string | null;
}

export interface ClientExportConversation {
	channel_id: string;
	type: number;
	name?: string | null;
	messages: Array<LocalIndexedMessage>;
}

export interface ClientExportArchive {
	version: number;
	exported_at: string;
	account: ClientExportAccount | null;
	guilds: Array<ClientExportGuild>;
	conversations: Array<ClientExportConversation>;
}

export function buildClientExportArchive(): ClientExportArchive {
	const me = Users.currentUser;
	const meRaw = me as unknown as {email?: string | null; phone?: string | null} | null;
	const account: ClientExportAccount | null = me
		? {
				id: me.id,
				username: me.username,
				discriminator: me.discriminator,
				email: meRaw?.email ?? null,
				phone: meRaw?.phone ?? null,
				bio: me.bio ?? null,
				avatar: me.avatar ?? null,
				created_at: me.createdAt && !Number.isNaN(me.createdAt.getTime()) ? me.createdAt.toISOString() : null,
				flags: me.flags ?? 0,
			}
		: null;

	const guilds: Array<ClientExportGuild> = Guilds.getGuilds().map((g) => ({
		id: g.id,
		name: g.name,
		icon: g.icon ?? null,
	}));

	const allMessages = localMessageSearchIndex.getAllMessages();
	const messagesByChannel = new Map<string, Array<LocalIndexedMessage>>();
	for (const msg of allMessages) {
		let list = messagesByChannel.get(msg.channel_id);
		if (!list) {
			list = [];
			messagesByChannel.set(msg.channel_id, list);
		}
		list.push(msg);
	}

	const conversations: Array<ClientExportConversation> = [];
	for (const [channelId, messages] of messagesByChannel.entries()) {
		const channel = Channels.getChannel(channelId);
		messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		conversations.push({
			channel_id: channelId,
			type: channel?.type ?? 1,
			name: channel?.name ?? null,
			messages,
		});
	}

	return {
		version: 1,
		exported_at: new Date().toISOString(),
		account,
		guilds,
		conversations,
	};
}

export async function exportClientUserData(i18n?: I18n): Promise<ClientExportArchive> {
	const archive = buildClientExportArchive();
	const jsonString = JSON.stringify(archive, null, 2);
	const timestamp = new Date().toISOString().slice(0, 10);
	const filename = `osaca-user-data-export-${timestamp}.json`;
	downloadTextFile(jsonString, filename, 'application/json');

	const successMessage = i18n ? i18n._(EXPORT_READY_DESCRIPTOR) : 'Your data export is ready and downloading.';
	ToastCommands.createToast({
		type: 'success',
		children: successMessage,
	});

	return archive;
}
