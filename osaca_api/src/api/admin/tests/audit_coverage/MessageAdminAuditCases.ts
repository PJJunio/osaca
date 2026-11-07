// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AdminAuditCoverageCase} from '@app/api/admin/tests/audit_coverage/AdminAuditCoverage';
import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createChannel, createGuild} from '@app/api/channel/tests/AttachmentTestUtils';
import {sendMessage} from '@app/api/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {expect} from 'vitest';

const UNKNOWN_SHRED_JOB_ID = '900000000000000004';

const COVERAGE_DECISION = {
	reason_code: DeletionReasons.SPAM,
	source: 'own_review',
	automation: 'none',
	statement: 'Coverage decision',
};

const COVERAGE_DECISION_METADATA = {
	decision_id: expect.any(String),
	reason_code: DeletionReasons.SPAM.toString(),
	kind: 'content_removal',
	notice_status: 'sent',
};

async function createAuthorChannel(harness: ApiTestHarness): Promise<{author: TestAccount; channelId: string}> {
	const author = await createTestAccount(harness);
	const guild = await createGuild(harness, author.token, 'Audit Message Guild');
	const channel = await createChannel(harness, author.token, guild.id, 'audit-messages');
	return {author, channelId: channel.id};
}

export const MessageAdminAuditCases: ReadonlyArray<AdminAuditCoverageCase> = [
	{
		method: 'GET',
		route: '/admin/messages/shreds/:job_id',
		async prepare() {
			return {
				request: {path: `/admin/messages/shreds/${UNKNOWN_SHRED_JOB_ID}`},
				expected: {
					action: 'get_message_shred_status',
					targetType: 'message_shred',
					targetId: '0',
					metadata: {job_id: UNKNOWN_SHRED_JOB_ID, status: 'not_found'},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/channels/:channel_id/messages/:message_id',
		async prepare({harness}) {
			const {author, channelId} = await createAuthorChannel(harness);
			const message = await sendMessage(harness, author.token, channelId, 'delete target');
			return {
				request: {
					path: `/admin/channels/${channelId}/messages/${message.id}`,
					body: {basis: {type: 'housekeeping'}},
				},
				expected: {
					action: 'delete_message',
					targetType: 'message',
					targetId: message.id,
					metadata: {channel_id: channelId, message_id: message.id, basis: 'housekeeping'},
				},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/users/:user_id/message-shreds/preview',
		async prepare({harness}) {
			const {author, channelId} = await createAuthorChannel(harness);
			const message = await sendMessage(harness, author.token, channelId, 'shred target');
			return {
				request: {
					path: `/admin/users/${author.userId}/message-shreds/preview`,
					body: {entries: [{channel_id: channelId, message_id: message.id}]},
				},
				expected: {
					action: 'preview_message_shred',
					targetType: 'message_shred',
					targetId: author.userId,
					metadata: {user_id: author.userId, requested_entries: '1', message_count: '1', skipped_entries: '0'},
				},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/users/:user_id/message-shreds',
		async prepare({harness}) {
			const {author, channelId} = await createAuthorChannel(harness);
			const message = await sendMessage(harness, author.token, channelId, 'shred target');
			return {
				request: {
					path: `/admin/users/${author.userId}/message-shreds`,
					body: {entries: [{channel_id: channelId, message_id: message.id}], basis: {type: 'holder_request'}},
				},
				expected: {
					action: 'queue_message_shred',
					targetType: 'message_shred',
					targetId: author.userId,
					metadata: {
						user_id: author.userId,
						job_id: expect.any(String),
						requested_entries: '1',
						basis: 'holder_request',
					},
				},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/users/:user_id/message-shreds',
		name: 'enforcement',
		async prepare({harness}) {
			const {author, channelId} = await createAuthorChannel(harness);
			const message = await sendMessage(harness, author.token, channelId, 'shred target');
			return {
				request: {
					path: `/admin/users/${author.userId}/message-shreds`,
					body: {
						entries: [{channel_id: channelId, message_id: message.id}],
						basis: {type: 'enforcement', decision: COVERAGE_DECISION},
					},
				},
				expected: {
					action: 'queue_message_shred',
					targetType: 'message_shred',
					targetId: author.userId,
					metadata: {
						user_id: author.userId,
						job_id: expect.any(String),
						requested_entries: '1',
						basis: 'enforcement',
						...COVERAGE_DECISION_METADATA,
					},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/messages',
		async prepare({harness}) {
			const {author, channelId} = await createAuthorChannel(harness);
			await sendMessage(harness, author.token, channelId, 'counted message');
			return {
				request: {path: `/admin/users/${author.userId}/messages`},
				expected: {
					action: 'delete_all_user_messages_dry_run',
					targetType: 'message_shred' === 'message_shred' ? 'message_deletion' : 'message_deletion',
					targetId: author.userId,
					metadata: {user_id: author.userId, channel_count: '1', message_count: '1', dry_run: 'true'},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/messages',
		name: 'enforcement',
		async prepare({harness}) {
			const {author, channelId} = await createAuthorChannel(harness);
			await sendMessage(harness, author.token, channelId, 'removed message');
			return {
				request: {
					path: `/admin/users/${author.userId}/messages?dry_run=false`,
					body: {basis: {type: 'enforcement', decision: COVERAGE_DECISION}},
				},
				expected: {
					action: 'delete_all_user_messages',
					targetType: 'message_deletion',
					targetId: author.userId,
					metadata: {
						user_id: author.userId,
						channel_count: '1',
						message_count: '1',
						dry_run: 'false',
						basis: 'enforcement',
						job_id: expect.any(String),
						...COVERAGE_DECISION_METADATA,
					},
				},
			};
		},
	},
];
