// SPDX-License-Identifier: AGPL-3.0-or-later

import {Channel} from '@app/features/channel/models/Channel';
import Channels from '@app/features/channel/state/Channels';
import {Guild} from '@app/features/guild/models/Guild';
import Guilds from '@app/features/guild/state/Guilds';
import SessionManager from '@app/features/platform/state/AuthSession';
import {http} from '@app/features/platform/transport/RestTransport';
import * as DownloadFile from '@app/features/platform/utils/DownloadFile';
import {localMessageSearchIndex} from '@app/features/search/state/LocalMessageSearchIndex';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {User} from '@app/features/user/models/User';
import Users from '@app/features/user/state/Users';
import {buildClientExportArchive, exportClientUserData} from '@app/features/user/utils/ClientDataExport';
import type {I18n} from '@lingui/core';
import {ChannelTypes} from '@osaca/constants/src/ChannelConstants';
import type {Channel as WireChannel} from '@osaca/schema/src/domains/channel/ChannelSchemas';
import type {Guild as WireGuild} from '@osaca/schema/src/domains/guild/GuildResponseSchemas';
import type {UserPrivate} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {runInAction} from 'mobx';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mockI18n = {
	_: (descriptor: {message?: string} | string) =>
		typeof descriptor === 'string' ? descriptor : (descriptor.message ?? ''),
} as unknown as I18n;

const channelsMap = (Channels as unknown as {channelsById: Map<string, Channel>}).channelsById;

function setMockCurrentUser(user: User | null): void {
	const sessionSnapshot = (
		SessionManager as unknown as {_snapshot: {context: {accountKey: string | null; userId: string | null}}}
	)._snapshot;
	const usersInternal = Users as unknown as {
		users: Record<string, User>;
		hydratedAccountKey: string | null;
	};

	runInAction(() => {
		if (user) {
			const accountKey = `test_account_${user.id}`;
			sessionSnapshot.context.accountKey = accountKey;
			sessionSnapshot.context.userId = user.id;
			usersInternal.users = {[user.id]: user};
			usersInternal.hydratedAccountKey = accountKey;
		} else {
			sessionSnapshot.context.accountKey = null;
			sessionSnapshot.context.userId = null;
			usersInternal.users = {};
			usersInternal.hydratedAccountKey = null;
		}
	});
}

describe('ClientDataExport', () => {
	beforeEach(() => {
		localMessageSearchIndex.clear();
		channelsMap.clear();
		runInAction(() => {
			Guilds.guilds = {};
		});
		setMockCurrentUser(null);
		vi.restoreAllMocks();
	});

	afterEach(() => {
		channelsMap.clear();
		runInAction(() => {
			Guilds.guilds = {};
		});
		setMockCurrentUser(null);
		vi.restoreAllMocks();
	});

	describe('buildClientExportArchive', () => {
		it('builds archive with null account when no user is logged in', () => {
			setMockCurrentUser(null);
			const archive = buildClientExportArchive();

			expect(archive.version).toBe(1);
			expect(typeof archive.exported_at).toBe('string');
			expect(archive.account).toBeNull();
			expect(archive.guilds).toEqual([]);
			expect(archive.conversations).toEqual([]);
		});

		it('builds archive with populated account, guilds, and chronological conversations', () => {
			const mockUser = new User({
				id: '108000000000000000',
				username: 'alice',
				discriminator: 1234,
				bio: 'Security researcher and privacy advocate',
				avatar: 'avatar_hash_abc',
				flags: 64,
			} as unknown as UserPrivate);
			(mockUser as unknown as {email?: string; phone?: string}).email = 'alice@example.com';
			(mockUser as unknown as {email?: string; phone?: string}).phone = '+1234567890';
			setMockCurrentUser(mockUser);

			runInAction(() => {
				Guilds.guilds = {
					guild_1: new Guild({
						id: 'guild_1',
						name: 'Privacy Commons',
						icon: 'icon_guild_1',
					} as unknown as WireGuild),
					guild_2: new Guild({
						id: 'guild_2',
						name: 'Local Dev',
						icon: null,
					} as unknown as WireGuild),
				};
			});

			channelsMap.set(
				'chan_dm_1',
				new Channel({
					id: 'chan_dm_1',
					type: ChannelTypes.DM,
					name: 'Direct Message with Bob',
				} as unknown as WireChannel),
			);

			// Add messages out of order to verify sorting by timestamp
			localMessageSearchIndex.indexMessage({
				id: 'msg_2',
				channel_id: 'chan_dm_1',
				content: 'Second message in conversation',
				timestamp: '2026-11-08T14:00:00.000Z',
				author: {id: '108000000000000000', username: 'alice', discriminator: '1234'},
			});

			localMessageSearchIndex.indexMessage({
				id: 'msg_1',
				channel_id: 'chan_dm_1',
				content: 'First message in conversation',
				timestamp: '2026-11-08T13:00:00.000Z',
				author: {id: 'user_bob_789', username: 'bob', discriminator: '5678'},
			});

			// Add message in another channel without an existing channel in state
			localMessageSearchIndex.indexMessage({
				id: 'msg_3',
				channel_id: 'chan_unknown',
				content: 'Message in archived or uncached channel',
				timestamp: '2026-11-08T15:00:00.000Z',
				author: {id: '108000000000000000', username: 'alice', discriminator: '1234'},
			});

			const archive = buildClientExportArchive();

			expect(archive.version).toBe(1);
			expect(archive.account).toEqual({
				id: '108000000000000000',
				username: 'alice',
				discriminator: 1234,
				email: 'alice@example.com',
				phone: '+1234567890',
				bio: 'Security researcher and privacy advocate',
				avatar: 'avatar_hash_abc',
				created_at: mockUser.createdAt.toISOString(),
				flags: 64,
			});

			expect(archive.guilds).toEqual([
				{id: 'guild_1', name: 'Privacy Commons', icon: 'icon_guild_1'},
				{id: 'guild_2', name: 'Local Dev', icon: null},
			]);

			expect(archive.conversations.length).toBe(2);

			const dmConv = archive.conversations.find((c) => c.channel_id === 'chan_dm_1');
			expect(dmConv).toBeDefined();
			expect(dmConv?.type).toBe(ChannelTypes.DM);
			expect(dmConv?.name).toBe('Direct Message with Bob');
			expect(dmConv?.messages.map((m) => m.id)).toEqual(['msg_1', 'msg_2']);

			const unknownConv = archive.conversations.find((c) => c.channel_id === 'chan_unknown');
			expect(unknownConv).toBeDefined();
			expect(unknownConv?.type).toBe(ChannelTypes.DM); // defaults to 1 (DM)
			expect(unknownConv?.name).toBeNull();
			expect(unknownConv?.messages.length).toBe(1);
		});
	});

	describe('exportClientUserData', () => {
		it('executes client-side export with ZERO network requests and triggers file download and toast', async () => {
			const mockUser = new User({
				id: '108000000000000000',
				username: 'alice',
				discriminator: 1234,
			} as unknown as UserPrivate);
			setMockCurrentUser(mockUser);

			localMessageSearchIndex.indexMessage({
				id: 'msg_secret',
				channel_id: 'dm_secret',
				content: 'Decrypted confidential data',
				timestamp: '2026-11-08T16:00:00.000Z',
				author: {id: '108000000000000000', username: 'alice', discriminator: '1234'},
			});

			const httpGetSpy = vi.spyOn(http, 'get');
			const httpPostSpy = vi.spyOn(http, 'post');
			const httpPutSpy = vi.spyOn(http, 'put');
			const httpDeleteSpy = vi.spyOn(http, 'delete');
			const toastSpy = vi.spyOn(ToastCommands, 'createToast');
			const downloadSpy = vi.spyOn(DownloadFile, 'downloadTextFile');

			const result = await exportClientUserData(mockI18n);

			// Strict assertion: ZERO network requests were dispatched
			expect(httpGetSpy).not.toHaveBeenCalled();
			expect(httpPostSpy).not.toHaveBeenCalled();
			expect(httpPutSpy).not.toHaveBeenCalled();
			expect(httpDeleteSpy).not.toHaveBeenCalled();

			// Assert download was initiated
			expect(downloadSpy).toHaveBeenCalledTimes(1);
			const [fileContent, fileName, mimeType] = downloadSpy.mock.calls[0];
			expect(fileName).toMatch(/^osaca-user-data-export-\d{4}-\d{2}-\d{2}\.json$/);
			expect(mimeType).toBe('application/json');

			const parsedArchive = JSON.parse(fileContent);
			expect(parsedArchive.version).toBe(1);
			expect(parsedArchive.account.username).toBe('alice');
			expect(parsedArchive.conversations.length).toBe(1);
			expect(parsedArchive.conversations[0].messages[0].content).toBe('Decrypted confidential data');

			// Assert toast feedback
			expect(toastSpy).toHaveBeenCalledWith({
				type: 'success',
				children: 'Your data export is ready and downloading.',
			});

			// Assert returned archive matches
			expect(result).toEqual(parsedArchive);
		});

		it('works without i18n parameter using default announcement string', async () => {
			const toastSpy = vi.spyOn(ToastCommands, 'createToast');
			const downloadSpy = vi.spyOn(DownloadFile, 'downloadTextFile');

			await exportClientUserData();

			expect(downloadSpy).toHaveBeenCalledTimes(1);
			expect(toastSpy).toHaveBeenCalledWith({
				type: 'success',
				children: 'Your data export is ready and downloading.',
			});
		});
	});
});
