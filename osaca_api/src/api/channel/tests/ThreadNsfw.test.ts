// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createReportID} from '@app/api/BrandedTypes';
import {
	acceptInvite,
	createChannel,
	createChannelInvite,
	createGuild,
	updateChannel,
} from '@app/api/channel/tests/ChannelTestUtils';
import {threadsRequest} from '@app/api/channel/tests/ThreadTestUtils';
import {clearChannelThreadsTaintCacheForTesting} from '@app/api/experiment/ChannelThreadsGate';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {ReportRepository} from '@app/api/report/ReportRepository';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {ChannelTypes} from '@osaca/constants/src/ChannelConstants';
import type {ThreadChannelResponse} from '@osaca/schema/src/domains/channel/ThreadRequestSchemas';
import type {MessageResponse} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface Setup {
	owner: TestAccount;
	member: TestAccount;
	guildId: string;
	sfwChannelId: string;
	nsfwChannelId: string;
}

describe('thread nsfw scope', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		clearChannelThreadsTaintCacheForTesting();
	});

	afterAll(async () => {
		clearChannelThreadsTaintCacheForTesting();
		await harness.shutdown();
	});

	async function setup(): Promise<Setup> {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'nsfw');
		const sfw = await createChannel(harness, owner.token, guild.id, 'sfw');
		const nsfw = await createChannel(harness, owner.token, guild.id, 'nsfw');
		await updateChannel(harness, owner.token, nsfw.id, {nsfw: true});
		const invite = await createChannelInvite(harness, owner.token, sfw.id);
		await acceptInvite(harness, member.token, invite.code);
		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);
		return {owner, member, guildId: guild.id, sfwChannelId: sfw.id, nsfwChannelId: nsfw.id};
	}

	function startThread(token: string, channelId: string) {
		return threadsRequest<ThreadChannelResponse>(harness, token)
			.post(`/channels/${channelId}/threads`)
			.body({name: 'topic', type: ChannelTypes.PUBLIC_THREAD})
			.expect(201)
			.execute();
	}

	function post(token: string, channelId: string, body: Record<string, unknown>) {
		return threadsRequest<MessageResponse>(harness, token)
			.post(`/channels/${channelId}/messages`)
			.body(body)
			.expect(200)
			.execute();
	}

	it('records the effective nsfw of the parent on a thread message report', async () => {
		const s = await setup();
		const invite = await createChannelInvite(harness, s.owner.token, s.nsfwChannelId);
		await acceptInvite(harness, s.member.token, invite.code);
		const thread = await startThread(s.owner.token, s.nsfwChannelId);
		const message = await post(s.owner.token, thread.id, {content: 'reported'});
		const report = await threadsRequest<{report_id: string}>(harness, s.member.token)
			.post('/reports/message')
			.body({channel_id: thread.id, message_id: message.id, category: 'harassment'})
			.expect(200)
			.execute();
		const stored = await new ReportRepository().getReport(createReportID(BigInt(report.report_id)));
		expect(stored?.reportedChannelEffectiveNsfw).toBe(true);
	});
});
