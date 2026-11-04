// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createFriendship, createGroupDmChannel} from '@app/api/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {ChannelTypes} from '@osaca/constants/src/ChannelConstants';
import type {ChannelResponse} from '@osaca/schema/src/domains/channel/ChannelSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('group dm mature content', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness.shutdown();
	});

	async function setup() {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const other = await createTestAccount(harness);
		await createFriendship(harness, owner, member);
		await createFriendship(harness, owner, other);
		await ensureSessionStarted(harness, owner.token);
		const group = await createGroupDmChannel(harness, owner.token, [member.userId, other.userId]);
		return {owner, member, other, groupId: group.id};
	}

	function setNsfw(account: TestAccount, channelId: string, nsfw: boolean, status = 200, code?: string) {
		return createBuilder<ChannelResponse>(harness, account.token)
			.patch(`/channels/${channelId}`)
			.body({type: ChannelTypes.GROUP_DM, nsfw})
			.expect(status, code)
			.execute();
	}

	it('lets the owner mark and clear the group', async () => {
		const s = await setup();
		const updated = await setNsfw(s.owner, s.groupId, true);
		expect(updated.nsfw).toBe(true);
		const cleared = await setNsfw(s.owner, s.groupId, false);
		expect(cleared.nsfw).toBe(false);
	});

	it('rejects the toggle from a member who is not the owner', async () => {
		const s = await setup();
		await setNsfw(s.member, s.groupId, true, 403);
	});

});
