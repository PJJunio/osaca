// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createDmChannel, createFriendship, createGroupDmChannel} from '@app/api/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {getGatewayService, getMlsDeliveryService} from '@app/api/middleware/ServiceRegistry';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {DeviceSession, ensureCryptoWasmReady, IdentityKey, MlsGroupSession} from '@osaca/crypto';
import type {MessageResponse} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import type {
	MlsClaimKeyPackageResponse,
	MlsCommitResponse,
	MlsGroupResponse,
	MlsKeyPackagesPublishResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
	return new Uint8Array(Buffer.from(base64, 'base64'));
}

describe('End-to-End Encrypted Private Conversations (F1-05 Tracer Bullet)', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		ensureCryptoWasmReady();
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	test('rejects plaintext content submission on DM channels with PLAINTEXT_PRIVATE_MESSAGING_DISABLED', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		await createFriendship(harness, alice, bob);

		const dm = await createDmChannel(harness, alice.token, bob.userId);
		await ensureSessionStarted(harness, alice.token);

		// Attempting to send plaintext content should be rejected
		const res = await createBuilder<{code: string}>(harness, alice.token)
			.post(`/channels/${dm.id}/messages`)
			.body({
				content: 'Hello Bob in plaintext!',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(res.code).toBe(APIErrorCodes.PLAINTEXT_PRIVATE_MESSAGING_DISABLED);
	});

	test('rejects plaintext content submission on Group DM channels with PLAINTEXT_PRIVATE_MESSAGING_DISABLED', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		const charlie = await createTestAccount(harness);

		await createFriendship(harness, alice, bob);
		await createFriendship(harness, alice, charlie);

		const groupDm = await createGroupDmChannel(harness, alice.token, [bob.userId, charlie.userId]);
		await ensureSessionStarted(harness, alice.token);

		// Attempting to send plaintext content should be rejected
		const res = await createBuilder<{code: string}>(harness, alice.token)
			.post(`/channels/${groupDm.id}/messages`)
			.body({
				content: 'Hello group in plaintext!',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(res.code).toBe(APIErrorCodes.PLAINTEXT_PRIVATE_MESSAGING_DISABLED);
	});

	test('allows two accounts to exchange MLS encrypted messages in a DM, storing only opaque ciphertext', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		await createFriendship(harness, alice, bob);
		await ensureSessionStarted(harness, alice.token);
		await ensureSessionStarted(harness, bob.token);

		// 1. Generate identity keys and device sessions for Alice and Bob
		const aliceIdentity = IdentityKey.generate(alice.userId);
		expect(aliceIdentity.publicKeyBytes.byteLength).toBe(32);
		const aliceDevice = DeviceSession.create(alice.userId, 'alice_device_1');

		const bobIdentity = IdentityKey.generate(bob.userId);
		expect(bobIdentity.publicKeyBytes.byteLength).toBe(32);
		const bobDevice = DeviceSession.create(bob.userId, 'bob_device_1');

		// 2. Bob publishes KeyPackages to Delivery Service
		const bobKpBytes = bobDevice.generateKeyPackage();
		await createBuilder<MlsKeyPackagesPublishResponse>(harness, bob.token)
			.post('/mls/key-packages')
			.body({
				device_id: bob.userId,
				key_packages: [bytesToBase64(bobKpBytes)],
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// 3. Alice creates DM channel with Bob
		const dm = await createDmChannel(harness, alice.token, bob.userId);
		const channelId = dm.id;

		// 4. Alice claims Bob's KeyPackage
		const claimRes = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
			.post(`/mls/devices/${bob.userId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const claimedKp = base64ToBytes(claimRes.key_package);

		// 5. Alice registers MLS group on server
		await createBuilder<MlsGroupResponse>(harness, alice.token)
			.post('/mls/groups')
			.body({group_id: channelId})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Alice creates MLS group session and adds Bob
		const groupIdBytes = new TextEncoder().encode(channelId);
		const aliceGroup = MlsGroupSession.create(aliceDevice, groupIdBytes);
		const addResult = aliceGroup.addMember(claimedKp);

		// 6. Alice posts Commit and Welcome to Delivery Service
		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${channelId}/commits`)
			.body({
				epoch: Number(addResult.epoch),
				commit: bytesToBase64(addResult.commit),
				welcome: bytesToBase64(addResult.welcome),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// 7. Bob fetches Welcome and joins the group session
		const welcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
			.get(`/mls/groups/${channelId}/welcomes/${Number(addResult.epoch)}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(welcomeRes.welcome));
		expect(bobGroup.getEpoch()).toBe(addResult.epoch);

		// 8. Spy on gateway dispatch to ensure MESSAGE_CREATE contains ciphertext
		const gateway = getGatewayService();
		const dispatchSpy = vi.spyOn(gateway, 'dispatchPresence');

		// 9. Alice encrypts application message and posts to channel
		const secretPlaintext = 'Top secret E2EE message from Alice to Bob';
		const ptBytes = new TextEncoder().encode(secretPlaintext);
		const ciphertextBytes = aliceGroup.encryptMessage(ptBytes);
		const ciphertextBase64 = bytesToBase64(ciphertextBytes);
		const epoch = Number(aliceGroup.getEpoch());

		const sendMsgRes = await createBuilder<MessageResponse>(harness, alice.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: ciphertextBase64,
				epoch,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(sendMsgRes.id).toBeDefined();
		expect(sendMsgRes.content).toBe('');
		expect((sendMsgRes as unknown as {ciphertext: string}).ciphertext).toBe(ciphertextBase64);

		// 10. Verify server database only stores ciphertext and NOT the plaintext
		const deliveryService = getMlsDeliveryService();
		const storedHistory = await deliveryService.getCiphertextHistory(channelId, 0);
		expect(storedHistory.length).toBe(1);
		expect(storedHistory[0]!.ciphertext).toBe(ciphertextBase64);
		expect(JSON.stringify(storedHistory)).not.toContain(secretPlaintext);

		// Verify gateway presence dispatch was received with ciphertext
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: BigInt(bob.userId),
				event: 'MESSAGE_CREATE',
				data: expect.objectContaining({
					channel_id: channelId,
					ciphertext: ciphertextBase64,
					epoch,
				}),
			}),
		);

		// 11. Bob receives ciphertext and decrypts it
		const processedByBob = bobGroup.processMessage(ciphertextBytes);
		expect(processedByBob.type).toBe('application');
		if (processedByBob.type === 'application') {
			const decryptedText = new TextDecoder().decode(processedByBob.plaintext);
			expect(decryptedText).toBe(secretPlaintext);
		}

		// 12. Bob replies with encrypted message
		const replyPlaintext = 'Secret reply from Bob!';
		const replyCtBytes = bobGroup.encryptMessage(new TextEncoder().encode(replyPlaintext));
		const replyCtBase64 = bytesToBase64(replyCtBytes);

		await createBuilder<MessageResponse>(harness, bob.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: replyCtBase64,
				epoch,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		// Alice decrypts Bob's reply
		const processedByAlice = aliceGroup.processMessage(replyCtBytes);
		expect(processedByAlice.type).toBe('application');
		if (processedByAlice.type === 'application') {
			const decryptedReply = new TextDecoder().decode(processedByAlice.plaintext);
			expect(decryptedReply).toBe(replyPlaintext);
		}

		// 13. Verify scrollback history endpoint returns ciphertext
		const historyRes = await createBuilder<Array<MessageResponse>>(harness, bob.token)
			.get(`/channels/${channelId}/messages`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(historyRes.length).toBe(2);
		expect(historyRes.every((m) => (m as unknown as {ciphertext?: string}).ciphertext !== undefined)).toBe(true);
		expect(historyRes.every((m) => m.content === '')).toBe(true);
	});

	test('supports three accounts in Group DM with member add, epoch advance, conflict retry, and member remove', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		const charlie = await createTestAccount(harness);

		await createFriendship(harness, alice, bob);
		await createFriendship(harness, alice, charlie);
		await createFriendship(harness, bob, charlie);
		await ensureSessionStarted(harness, alice.token);
		await ensureSessionStarted(harness, bob.token);
		await ensureSessionStarted(harness, charlie.token);

		const aliceDevice = DeviceSession.create(alice.userId, 'alice_device');
		const bobDevice = DeviceSession.create(bob.userId, 'bob_device');
		const charlieDevice = DeviceSession.create(charlie.userId, 'charlie_device');

		// Publish initial KeyPackages for Bob and Charlie
		const bobKp = bobDevice.generateKeyPackage();
		await createBuilder<MlsKeyPackagesPublishResponse>(harness, bob.token)
			.post('/mls/key-packages')
			.body({device_id: bob.userId, key_packages: [bytesToBase64(bobKp)]})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		const charlieKp = charlieDevice.generateKeyPackage();
		await createBuilder<MlsKeyPackagesPublishResponse>(harness, charlie.token)
			.post('/mls/key-packages')
			.body({device_id: charlie.userId, key_packages: [bytesToBase64(charlieKp)]})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Alice creates Group DM
		const groupDm = await createGroupDmChannel(harness, alice.token, [bob.userId, charlie.userId]);
		const groupId = groupDm.id;

		await createBuilder<MlsGroupResponse>(harness, alice.token)
			.post('/mls/groups')
			.body({group_id: groupId})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Alice creates local group
		const aliceGroup = MlsGroupSession.create(aliceDevice, new TextEncoder().encode(groupId));

		// Alice adds Bob (epoch 1)
		const bobClaim = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
			.post(`/mls/devices/${bob.userId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const addBobResult = aliceGroup.addMember(base64ToBytes(bobClaim.key_package));

		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: Number(addBobResult.epoch),
				commit: bytesToBase64(addBobResult.commit),
				welcome: bytesToBase64(addBobResult.welcome),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Bob joins at epoch 1
		const bobWelcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
			.get(`/mls/groups/${groupId}/welcomes/${Number(addBobResult.epoch)}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(bobWelcomeRes.welcome));
		expect(bobGroup.getEpoch()).toBe(addBobResult.epoch);

		// Alice adds Charlie (advances to epoch 2)
		const charlieClaim = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
			.post(`/mls/devices/${charlie.userId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const addCharlieResult = aliceGroup.addMember(base64ToBytes(charlieClaim.key_package));

		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: Number(addCharlieResult.epoch),
				commit: bytesToBase64(addCharlieResult.commit),
				welcome: bytesToBase64(addCharlieResult.welcome),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Charlie joins from Welcome at epoch 2
		const charlieWelcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, charlie.token)
			.get(`/mls/groups/${groupId}/welcomes/${Number(addCharlieResult.epoch)}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const charlieGroup = MlsGroupSession.joinFromWelcome(charlieDevice, base64ToBytes(charlieWelcomeRes.welcome));
		expect(charlieGroup.getEpoch()).toBe(addCharlieResult.epoch);

		// Bob syncs commit to advance to epoch 2
		bobGroup.processMessage(addCharlieResult.commit);
		expect(bobGroup.getEpoch()).toBe(addCharlieResult.epoch);

		// Test commit conflict (HTTP 409):
		// Attempting to post another commit for an already-advanced epoch returns 409
		await createBuilder<{code: string}>(harness, bob.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: 2, // epoch 2 was already committed
				commit: bytesToBase64(new Uint8Array([1, 2, 3])),
			})
			.expect(HTTP_STATUS.CONFLICT)
			.execute();

		// All 3 members can now communicate at epoch 2
		const groupMsg = 'Broadcast to all 3 group members';
		const ctBytes = aliceGroup.encryptMessage(new TextEncoder().encode(groupMsg));

		const bobProcessed = bobGroup.processMessage(ctBytes);
		expect(bobProcessed.type).toBe('application');
		if (bobProcessed.type === 'application') {
			expect(new TextDecoder().decode(bobProcessed.plaintext)).toBe(groupMsg);
		}

		const charlieProcessed = charlieGroup.processMessage(ctBytes);
		expect(charlieProcessed.type).toBe('application');
		if (charlieProcessed.type === 'application') {
			expect(new TextDecoder().decode(charlieProcessed.plaintext)).toBe(groupMsg);
		}

		// Alice removes Charlie (leafIndex 2) -> advances to epoch 3
		const removeCommitBytes = aliceGroup.removeMember(2);
		const epoch3 = Number(aliceGroup.getEpoch());

		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${groupId}/commits`)
			.body({
				epoch: epoch3,
				commit: bytesToBase64(removeCommitBytes),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Bob processes remove commit
		bobGroup.processMessage(removeCommitBytes);
		expect(bobGroup.getEpoch()).toBe(BigInt(epoch3));

		// Alice sends message at epoch 3 (after Charlie was removed)
		const postRemoveMsg = 'Private message between Alice and Bob only';
		const postRemoveCt = aliceGroup.encryptMessage(new TextEncoder().encode(postRemoveMsg));

		// Bob can decrypt
		const bobPostProcessed = bobGroup.processMessage(postRemoveCt);
		expect(bobPostProcessed.type).toBe('application');
		if (bobPostProcessed.type === 'application') {
			expect(new TextDecoder().decode(bobPostProcessed.plaintext)).toBe(postRemoveMsg);
		}

		// Charlie (still at epoch 2, removed) cannot process epoch 3 message
		expect(() => charlieGroup.processMessage(postRemoveCt)).toThrow();
	});
});
