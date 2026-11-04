// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {acceptInvite, createChannelInvite, createGuild, getChannel} from '@app/api/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {beforeAll, beforeEach, describe, it} from 'vitest';

describe('Channel Operation Permissions', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	it('should reject nonmember from getting channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const nonmember = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);
		await createBuilder(harness, nonmember.token)
			.get(`/channels/${systemChannel.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
	it('should reject member from updating channel without MANAGE_CHANNELS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);
		await createBuilder(harness, member.token)
			.patch(`/channels/${systemChannel.id}`)
			.body({name: 'hacked'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
	it('should reject member from deleting channel without MANAGE_CHANNELS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);
		await createBuilder(harness, member.token)
			.delete(`/channels/${systemChannel.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
