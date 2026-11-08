// SPDX-License-Identifier: AGPL-3.0-or-later

import type {Message as WireMessage} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import {beforeEach, describe, expect, it} from 'vitest';
import {localMessageSearchIndex} from './LocalMessageSearchIndex';

describe('LocalMessageSearchIndex', () => {
	beforeEach(() => {
		localMessageSearchIndex.clear();
	});

	it('indexes and searches decrypted messages by keyword', () => {
		localMessageSearchIndex.indexMessage({
			id: '1001',
			channel_id: 'dm_chan_1',
			content: 'Hello world, this is a private message',
			timestamp: '2026-11-08T10:00:00.000Z',
			author: {id: 'user_alice', username: 'alice', discriminator: '1'} as unknown as WireMessage['author'],
		});
		localMessageSearchIndex.indexMessage({
			id: '1002',
			channel_id: 'dm_chan_1',
			content: 'Another secret conversation note',
			timestamp: '2026-11-08T10:05:00.000Z',
			author: {id: 'user_bob', username: 'bob', discriminator: '2'} as unknown as WireMessage['author'],
		});

		const result1 = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'private'});
		expect(result1.total).toBe(1);
		expect(result1.messages[0].id).toBe('1001');

		const result2 = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'conversation'});
		expect(result2.total).toBe(1);
		expect(result2.messages[0].id).toBe('1002');

		const resultCase = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'SECRET'});
		expect(resultCase.total).toBe(1);
		expect(resultCase.messages[0].id).toBe('1002');
	});

	it('matches exact phrases', () => {
		localMessageSearchIndex.indexMessage({
			id: '2001',
			channel_id: 'dm_chan_1',
			content: 'The quick brown fox jumps over the lazy dog',
			timestamp: '2026-11-08T11:00:00.000Z',
		});
		localMessageSearchIndex.indexMessage({
			id: '2002',
			channel_id: 'dm_chan_1',
			content: 'The quick dog jumps over the lazy fox',
			timestamp: '2026-11-08T11:01:00.000Z',
		});

		const res = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {exactPhrases: ['quick brown fox']});
		expect(res.total).toBe(1);
		expect(res.messages[0].id).toBe('2001');
	});

	it('filters by authorId and excludeAuthorId', () => {
		localMessageSearchIndex.indexMessage({
			id: '3001',
			channel_id: 'dm_chan_1',
			content: 'Message from Alice',
			timestamp: '2026-11-08T12:00:00.000Z',
			author: {id: 'alice_id', username: 'alice'} as unknown as WireMessage['author'],
		});
		localMessageSearchIndex.indexMessage({
			id: '3002',
			channel_id: 'dm_chan_1',
			content: 'Message from Bob',
			timestamp: '2026-11-08T12:01:00.000Z',
			author: {id: 'bob_id', username: 'bob'} as unknown as WireMessage['author'],
		});

		const aliceRes = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {authorId: ['alice_id']});
		expect(aliceRes.total).toBe(1);
		expect(aliceRes.messages[0].id).toBe('3001');

		const excludeAliceRes = localMessageSearchIndex.search(
			{contextChannelId: 'dm_chan_1'},
			{excludeAuthorId: ['alice_id']},
		);
		expect(excludeAliceRes.total).toBe(1);
		expect(excludeAliceRes.messages[0].id).toBe('3002');
	});

	it('filters by has categories (file, image, link, embed)', () => {
		localMessageSearchIndex.indexMessage({
			id: '4001',
			channel_id: 'dm_chan_1',
			content: 'Check this link: https://example.com',
			timestamp: '2026-11-08T13:00:00.000Z',
		});
		localMessageSearchIndex.indexMessage({
			id: '4002',
			channel_id: 'dm_chan_1',
			content: 'Here is an image',
			timestamp: '2026-11-08T13:01:00.000Z',
			attachments: [
				{
					id: 'att_1',
					filename: 'photo.jpg',
					size: 1024,
					url: 'https://cdn.example.com/photo.jpg',
					content_type: 'image/jpeg',
				},
			] as unknown as WireMessage['attachments'],
		});

		const linkRes = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {has: ['link']});
		expect(linkRes.total).toBe(1);
		expect(linkRes.messages[0].id).toBe('4001');

		const imageRes = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {has: ['image']});
		expect(imageRes.total).toBe(1);
		expect(imageRes.messages[0].id).toBe('4002');

		const excludeFileRes = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {excludeHas: ['file']});
		expect(excludeFileRes.total).toBe(1);
		expect(excludeFileRes.messages[0].id).toBe('4001');
	});

	it('filters by pinned and mentions', () => {
		localMessageSearchIndex.indexMessage({
			id: '5001',
			channel_id: 'dm_chan_1',
			content: 'Hey @charlie look at this',
			timestamp: '2026-11-08T14:00:00.000Z',
			pinned: true,
			mentions: [{id: 'user_charlie'}] as unknown as WireMessage['mentions'],
		});
		localMessageSearchIndex.indexMessage({
			id: '5002',
			channel_id: 'dm_chan_1',
			content: 'Unpinned message',
			timestamp: '2026-11-08T14:01:00.000Z',
			pinned: false,
		});

		const pinnedRes = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {pinned: true});
		expect(pinnedRes.total).toBe(1);
		expect(pinnedRes.messages[0].id).toBe('5001');

		const mentionsRes = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {mentions: ['user_charlie']});
		expect(mentionsRes.total).toBe(1);
		expect(mentionsRes.messages[0].id).toBe('5001');
	});

	it('supports message edit / update in index', () => {
		localMessageSearchIndex.indexMessage({
			id: '6001',
			channel_id: 'dm_chan_1',
			content: 'Original content before typo fix',
			timestamp: '2026-11-08T15:00:00.000Z',
		});

		let searchBefore = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'Original'});
		expect(searchBefore.total).toBe(1);

		localMessageSearchIndex.updateMessage('dm_chan_1', '6001', {
			content: 'Updated content after editing',
			edited_timestamp: '2026-11-08T15:05:00.000Z',
		});

		searchBefore = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'Original'});
		expect(searchBefore.total).toBe(0);

		const searchAfter = localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'Updated'});
		expect(searchAfter.total).toBe(1);
		expect(searchAfter.messages[0].content).toBe('Updated content after editing');
	});

	it('supports message deletion and removal from index', () => {
		localMessageSearchIndex.indexMessage({
			id: '7001',
			channel_id: 'dm_chan_1',
			content: 'Message to be deleted',
			timestamp: '2026-11-08T16:00:00.000Z',
		});

		expect(localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'deleted'}).total).toBe(1);

		localMessageSearchIndex.removeMessage('dm_chan_1', '7001');

		expect(localMessageSearchIndex.search({contextChannelId: 'dm_chan_1'}, {content: 'deleted'}).total).toBe(0);
	});

	it('supports sorting by timestamp and relevance, with pagination', () => {
		for (let i = 1; i <= 30; i++) {
			localMessageSearchIndex.indexMessage({
				id: `80${i.toString().padStart(2, '0')}`,
				channel_id: 'dm_chan_2',
				content: `Decrypted message item number ${i} with common tag`,
				timestamp: new Date(1700000000000 + i * 60000).toISOString(),
			});
		}

		// Pagination: page 1
		const page1 = localMessageSearchIndex.search(
			{contextChannelId: 'dm_chan_2'},
			{content: 'common tag', hitsPerPage: 10, page: 1, sortOrder: 'desc'},
		);
		expect(page1.total).toBe(30);
		expect(page1.messages.length).toBe(10);
		expect(page1.messages[0].id).toBe('8030'); // Newest first

		// Pagination: page 2
		const page2 = localMessageSearchIndex.search(
			{contextChannelId: 'dm_chan_2'},
			{content: 'common tag', hitsPerPage: 10, page: 2, sortOrder: 'desc'},
		);
		expect(page2.messages.length).toBe(10);
		expect(page2.messages[0].id).toBe('8020');

		// Sort asc: oldest first
		const ascResult = localMessageSearchIndex.search(
			{contextChannelId: 'dm_chan_2'},
			{content: 'common tag', hitsPerPage: 5, page: 1, sortOrder: 'asc'},
		);
		expect(ascResult.messages[0].id).toBe('8001');
	});
});
