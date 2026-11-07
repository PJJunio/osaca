// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {getGatewayService} from '@app/api/middleware/ServiceRegistry';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import type {
	MlsCiphertextHistoryResponse,
	MlsCiphertextMessageResponse,
	MlsClaimKeyPackageResponse,
	MlsCommitDetailResponse,
	MlsCommitResponse,
	MlsGroupResponse,
	MlsKeyPackagesPublishResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

describe('MLS Delivery Service API', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	test('requires authentication for MLS routes', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/mls/key-packages')
			.body({device_id: 'dev1', key_packages: ['pkg1']})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/mls/devices/dev1/claim-key-package')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/mls/groups')
			.body({group_id: 'grp1'})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('publishes and claims KeyPackages until exhaustion', async () => {
		const account = await createTestAccount(harness);
		const deviceId = 'device_alice_phone';
		const pkg1 = Buffer.from('key_package_content_1').toString('base64');
		const pkg2 = Buffer.from('key_package_content_2').toString('base64');
		const pkg3 = Buffer.from('key_package_content_3').toString('base64');

		// Publish 3 key packages
		const publishRes = await createBuilder<MlsKeyPackagesPublishResponse>(harness, account.token)
			.post('/mls/key-packages')
			.body({
				device_id: deviceId,
				key_packages: [pkg1, pkg2, pkg3],
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		expect(publishRes.published).toBe(3);

		// Claim 1st package
		const claim1 = await createBuilder<MlsClaimKeyPackageResponse>(harness, account.token)
			.post(`/mls/devices/${deviceId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(claim1.key_package).toBe(pkg1);

		// Claim 2nd package
		const claim2 = await createBuilder<MlsClaimKeyPackageResponse>(harness, account.token)
			.post(`/mls/devices/${deviceId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(claim2.key_package).toBe(pkg2);

		// Claim 3rd package
		const claim3 = await createBuilder<MlsClaimKeyPackageResponse>(harness, account.token)
			.post(`/mls/devices/${deviceId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(claim3.key_package).toBe(pkg3);

		// 4th claim must fail with 404 (MLS_KEY_PACKAGE_EXHAUSTED)
		const exhaustionRes = await createBuilder(harness, account.token)
			.post(`/mls/devices/${deviceId}/claim-key-package`)
			.expect(HTTP_STATUS.NOT_FOUND, APIErrorCodes.MLS_KEY_PACKAGE_EXHAUSTED)
			.executeWithResponse();

		const errorJson = exhaustionRes.json as {code: string};
		expect(errorJson.code).toBe(APIErrorCodes.MLS_KEY_PACKAGE_EXHAUSTED);
	});

	test('enforces strict single-Commit-per-Epoch ordering and rejects conflicts with 409', async () => {
		const account = await createTestAccount(harness);
		const groupId = 'group_project_room';

		// Create MLS Group
		const group = await createBuilder<MlsGroupResponse>(harness, account.token)
			.post('/mls/groups')
			.body({
				group_id: groupId,
				disappearing_ttl_seconds: 3600,
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		expect(group.group_id).toBe(groupId);
		expect(group.current_epoch).toBe(0);
		expect(group.disappearing_ttl_seconds).toBe(3600);

		// Fetch group metadata
		const fetchedGroup = await createBuilder<MlsGroupResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(fetchedGroup.current_epoch).toBe(0);

		const commitEpoch1 = Buffer.from('commit_epoch_1_bytes').toString('base64');
		const welcomeEpoch1 = Buffer.from('welcome_epoch_1_bytes').toString('base64');

		// Commit to advance epoch from 0 to 1
		const commitRes = await createBuilder<MlsCommitResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 1,
				commit: commitEpoch1,
				welcome: welcomeEpoch1,
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();
		expect(commitRes.epoch).toBe(1);

		// Group current_epoch is now 1
		const groupAfterEpoch1 = await createBuilder<MlsGroupResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(groupAfterEpoch1.current_epoch).toBe(1);

		// Concurrent/duplicate commit to epoch 1 must fail with 409 Conflict
		const conflictRes = await createBuilder(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 1,
				commit: Buffer.from('competing_commit_1').toString('base64'),
			})
			.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.MLS_EPOCH_CONFLICT)
			.executeWithResponse();

		const conflictJson = conflictRes.json as {code: string; current_epoch: number; requested_epoch: number};
		expect(conflictJson.code).toBe(APIErrorCodes.MLS_EPOCH_CONFLICT);
		expect(conflictJson.current_epoch).toBe(1);
		expect(conflictJson.requested_epoch).toBe(1);

		// Stale commit to epoch 0 must fail with 409 Conflict
		await createBuilder(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 0,
				commit: Buffer.from('stale_commit_0').toString('base64'),
			})
			.expect(HTTP_STATUS.CONFLICT)
			.execute();

		// Skipping epoch (requesting epoch 3 when current is 1) must fail with 409 Conflict
		await createBuilder(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 3,
				commit: Buffer.from('out_of_order_commit_3').toString('base64'),
			})
			.expect(HTTP_STATUS.CONFLICT)
			.execute();

		// Sequential commit to epoch 2 succeeds
		const commitRes2 = await createBuilder<MlsCommitResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 2,
				commit: Buffer.from('commit_epoch_2_bytes').toString('base64'),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();
		expect(commitRes2.epoch).toBe(2);

		// Retrieve commit and welcome messages
		const storedCommit = await createBuilder<MlsCommitDetailResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}/commits/1`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(storedCommit.commit).toBe(commitEpoch1);

		const storedWelcome = await createBuilder<MlsWelcomeDetailResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}/welcomes/1`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(storedWelcome.welcome).toBe(welcomeEpoch1);
	});

	test('stores ciphertext, dispatches gateway event, and enforces ADR-0012 v1 join epoch boundary', async () => {
		const account = await createTestAccount(harness);
		const groupId = 'group_chat_test';

		await createBuilder<MlsGroupResponse>(harness, account.token)
			.post('/mls/groups')
			.body({group_id: groupId})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		const gateway = getGatewayService();
		const dispatchSpy = vi.spyOn(gateway, 'dispatchPresence');

		// Message 1 at epoch 0
		const cipher0 = Buffer.from('opaque_ciphertext_epoch_0').toString('base64');
		const post0 = await createBuilder<MlsCiphertextMessageResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/messages`)
			.body({
				epoch: 0,
				message_id: 'msg_epoch_0',
				ciphertext: cipher0,
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		expect(post0.message_id).toBe('msg_epoch_0');
		expect(post0.epoch).toBe(0);
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'MESSAGE_CREATE',
				data: expect.objectContaining({
					id: 'msg_epoch_0',
					channel_id: groupId,
					epoch: 0,
					ciphertext: cipher0,
				}),
			}),
		);

		// Advance group to epoch 1
		await createBuilder<MlsCommitResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 1,
				commit: Buffer.from('commit_1').toString('base64'),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Message 2 at epoch 1
		const cipher1 = Buffer.from('opaque_ciphertext_epoch_1').toString('base64');
		await createBuilder<MlsCiphertextMessageResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/messages`)
			.body({
				epoch: 1,
				message_id: 'msg_epoch_1',
				ciphertext: cipher1,
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Advance group to epoch 2
		await createBuilder<MlsCommitResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 2,
				commit: Buffer.from('commit_2').toString('base64'),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Message 3 at epoch 2
		const cipher2 = Buffer.from('opaque_ciphertext_epoch_2').toString('base64');
		await createBuilder<MlsCiphertextMessageResponse>(harness, account.token)
			.post(`/mls/groups/${groupId}/messages`)
			.body({
				epoch: 2,
				message_id: 'msg_epoch_2',
				ciphertext: cipher2,
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Member joins at epoch 1 (ADR-0012 v1 rule)
		// They should see epoch 1 and epoch 2 messages, but NEVER epoch 0 messages!
		const historyForNewMember = await createBuilder<MlsCiphertextHistoryResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}/messages?member_join_epoch=1`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const msgIds = historyForNewMember.messages.map((m) => m.message_id);
		expect(msgIds).not.toContain('msg_epoch_0');
		expect(msgIds).toContain('msg_epoch_1');
		expect(msgIds).toContain('msg_epoch_2');

		// Member joined at epoch 0 sees all messages
		const historyForFounder = await createBuilder<MlsCiphertextHistoryResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}/messages?member_join_epoch=0`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const founderMsgIds = historyForFounder.messages.map((m) => m.message_id);
		expect(founderMsgIds).toContain('msg_epoch_0');
		expect(founderMsgIds).toContain('msg_epoch_1');
		expect(founderMsgIds).toContain('msg_epoch_2');

		// Pagination with limit
		const paged = await createBuilder<MlsCiphertextHistoryResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}/messages?member_join_epoch=0&limit=1`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(paged.messages).toHaveLength(1);
		expect(paged.messages[0].message_id).toBe('msg_epoch_2');

		// Next page with cursor
		const paged2 = await createBuilder<MlsCiphertextHistoryResponse>(harness, account.token)
			.get(`/mls/groups/${groupId}/messages?member_join_epoch=0&limit=1&before=msg_epoch_2`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(paged2.messages).toHaveLength(1);
		expect(paged2.messages[0].message_id).toBe('msg_epoch_1');
	});
});
