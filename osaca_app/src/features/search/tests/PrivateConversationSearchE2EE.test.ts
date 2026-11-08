// SPDX-License-Identifier: AGPL-3.0-or-later

import {Channel} from '@app/features/channel/models/Channel';
import Channels from '@app/features/channel/state/Channels';
import {http} from '@app/features/platform/transport/RestTransport';
import {localMessageSearchIndex} from '@app/features/search/state/LocalMessageSearchIndex';
import {isPrivateConversationSearch, searchMessages} from '@app/features/search/utils/SearchUtils';
import type {I18n} from '@lingui/core';
import {ChannelTypes} from '@osaca/constants/src/ChannelConstants';
import type {Channel as WireChannel} from '@osaca/schema/src/domains/channel/ChannelSchemas';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mockI18n = {
	_: (descriptor: {message?: string} | string) =>
		typeof descriptor === 'string' ? descriptor : (descriptor.message ?? ''),
} as unknown as I18n;

const channelsMap = (Channels as unknown as {channelsById: Map<string, Channel>}).channelsById;

describe('Private Conversation Search (E2EE Client-Side)', () => {
	beforeEach(() => {
		localMessageSearchIndex.clear();
		channelsMap.clear();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		channelsMap.clear();
		vi.restoreAllMocks();
	});

	describe('isPrivateConversationSearch routing', () => {
		it('detects all_dms and open_dms scopes as private search', () => {
			expect(isPrivateConversationSearch({}, {scope: 'all_dms'})).toBe(true);
			expect(isPrivateConversationSearch({}, {scope: 'open_dms'})).toBe(true);
		});

		it('detects private channels without guild as private search', () => {
			channelsMap.set(
				'dm_123',
				new Channel({
					id: 'dm_123',
					type: ChannelTypes.DM,
					name: 'alice',
				} as unknown as WireChannel),
			);

			expect(isPrivateConversationSearch({contextChannelId: 'dm_123'}, {})).toBe(true);
		});

		it('detects context without guild ID as private search', () => {
			expect(isPrivateConversationSearch({contextGuildId: null}, {scope: 'current'})).toBe(true);
			expect(isPrivateConversationSearch({}, {})).toBe(true);
		});

		it('does NOT treat guild channels as private search', () => {
			channelsMap.set(
				'guild_chan_1',
				new Channel({
					id: 'guild_chan_1',
					guild_id: 'guild_456',
					type: ChannelTypes.GUILD_TEXT,
					name: 'general',
				} as unknown as WireChannel),
			);

			expect(isPrivateConversationSearch({contextGuildId: 'guild_456', contextChannelId: 'guild_chan_1'}, {})).toBe(
				false,
			);
		});
	});

	describe('searchMessages zero-network routing', () => {
		it('queries local search index with ZERO network requests for private searches', async () => {
			localMessageSearchIndex.indexMessage({
				id: 'dm_msg_100',
				channel_id: 'dm_channel_private',
				content: 'Super secret private confidential discussion',
				timestamp: '2026-11-08T12:00:00.000Z',
				author: {id: 'user_alice', username: 'alice', discriminator: '1'},
			});

			const postSpy = vi.spyOn(http, 'post');

			const result = await searchMessages(
				mockI18n,
				{contextChannelId: 'dm_channel_private'},
				{content: 'confidential', scope: 'current'},
			);

			// Assert ZERO network calls to /search/messages or any other HTTP endpoint
			expect(postSpy).not.toHaveBeenCalled();

			if ('indexing' in result) {
				expect.fail('Should not be indexing');
			}

			expect(result.total).toBe(1);
			expect(result.messages.length).toBe(1);
			expect(result.messages[0].id).toBe('dm_msg_100');
			expect(result.messages[0].content).toBe('Super secret private confidential discussion');
		});

		it('calls server HTTP endpoint for public guild channels', async () => {
			channelsMap.set(
				'public_chan_1',
				new Channel({
					id: 'public_chan_1',
					guild_id: 'guild_1',
					type: ChannelTypes.GUILD_TEXT,
					name: 'general',
				} as unknown as WireChannel),
			);

			const postSpy = vi.spyOn(http, 'post').mockResolvedValue({
				body: {
					messages: [
						{
							id: 'server_msg_1',
							channel_id: 'public_chan_1',
							guild_id: 'guild_1',
							content: 'Server-indexed public message',
							timestamp: '2026-11-08T12:00:00.000Z',
							author: {id: 'user_bob', username: 'bob', discriminator: 2},
							type: 0,
							flags: 0,
							pinned: false,
							mention_everyone: false,
						},
					],
					channels: [
						{
							id: 'public_chan_1',
							guild_id: 'guild_1',
							name: 'general',
							type: 0,
						},
					],
					total: 1,
					hits_per_page: 25,
					page: 1,
				},
			} as unknown as Awaited<ReturnType<typeof http.post>>);

			const result = await searchMessages(
				mockI18n,
				{contextGuildId: 'guild_1', contextChannelId: 'public_chan_1'},
				{content: 'public'},
			);

			expect(postSpy).toHaveBeenCalledTimes(1);
			expect(postSpy).toHaveBeenCalledWith('/search/messages', expect.any(Object));

			if ('indexing' in result) {
				expect.fail('Should not be indexing');
			}

			expect(result.total).toBe(1);
			expect(result.messages[0].id).toBe('server_msg_1');
		});
	});
});
