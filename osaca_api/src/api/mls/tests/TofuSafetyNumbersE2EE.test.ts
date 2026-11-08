// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createDmChannel, createFriendship} from '@app/api/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {
	DeviceSession,
	ensureCryptoWasmReady,
	MemoryTofuStorage,
	MlsGroupSession,
	TofuIdentityStore,
	verifySafetyNumberQr,
} from '@osaca/crypto';
import type {
	MlsClaimKeyPackageResponse,
	MlsCommitResponse,
	MlsGroupResponse,
	MlsKeyPackagesPublishResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
	return new Uint8Array(Buffer.from(base64, 'base64'));
}

describe('TOFU Identity Tracking and Safety Numbers E2EE Flow', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		ensureCryptoWasmReady();
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	test('end-to-end: TOFU initial key trust, safety number derivation, and key change detection', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		await createFriendship(harness, alice, bob);

		const dmChannel = await createDmChannel(harness, alice.token, bob.userId);
		await ensureSessionStarted(harness, alice.token);
		await ensureSessionStarted(harness, bob.token);

		// Alice and Bob generate devices
		const aliceDevice = DeviceSession.create(alice.userId, `dev_${alice.userId}_1`);
		const bobDevice = DeviceSession.create(bob.userId, `dev_${bob.userId}_1`);

		// Alice and Bob initialize TOFU stores
		const aliceStorage = new MemoryTofuStorage();
		const bobStorage = new MemoryTofuStorage();
		const aliceTofu = new TofuIdentityStore(alice.userId, aliceStorage);
		const bobTofu = new TofuIdentityStore(bob.userId, bobStorage);

		// Bob publishes KeyPackage
		const bobKp = bobDevice.generateKeyPackage();
		await createBuilder<MlsKeyPackagesPublishResponse>(harness, bob.token)
			.post('/mls/key-packages')
			.body({
				device_id: bob.userId,
				key_packages: [bytesToBase64(bobKp)],
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Alice creates MLS group on server
		await createBuilder<MlsGroupResponse>(harness, alice.token)
			.post('/mls/groups')
			.body({group_id: dmChannel.id})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Alice claims Bob's KeyPackage
		const claimRes = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
			.post(`/mls/devices/${bob.userId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const claimedBobKp = base64ToBytes(claimRes.key_package);

		// Alice creates local group session and adds Bob
		const groupId = new TextEncoder().encode(dmChannel.id);
		const aliceGroup = MlsGroupSession.create(aliceDevice, groupId);
		const addResult = aliceGroup.addMember(claimedBobKp);

		// Post commit & welcome
		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${dmChannel.id}/commits`)
			.body({
				epoch: Number(addResult.epoch),
				commit: bytesToBase64(addResult.commit),
				welcome: bytesToBase64(addResult.welcome),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Alice records Bob's identity into TOFU from group members
		const aliceGroupMembers = aliceGroup.getMembers();
		const aliceTofuResults = aliceTofu.checkGroupMembers(aliceGroupMembers);
		expect(aliceTofuResults).toHaveLength(1);
		expect(aliceTofuResults[0].status).toBe('first_seen');
		expect(aliceTofu.hasKeyChanged(bob.userId)).toBe(false);

		// Bob fetches welcome and joins
		const welcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
			.get(`/mls/groups/${dmChannel.id}/welcomes/1`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(welcomeRes.welcome));
		const bobGroupMembers = bobGroup.getMembers();
		const bobTofuResults = bobTofu.checkGroupMembers(bobGroupMembers);
		expect(bobTofuResults).toHaveLength(1);
		expect(bobTofuResults[0].status).toBe('first_seen');
		expect(bobTofu.hasKeyChanged(alice.userId)).toBe(false);

		// Alice and Bob derive Safety Numbers for each other using their group identity keys
		const aliceSigKey = aliceGroupMembers.find((m) => m.identity.startsWith(alice.userId))!.signatureKey;
		const bobSigKey = bobGroupMembers.find((m) => m.identity.startsWith(bob.userId))!.signatureKey;

		const aliceSafetyNumber = await aliceTofu.deriveSafetyNumber(bob.userId, aliceSigKey);
		const bobSafetyNumber = await bobTofu.deriveSafetyNumber(alice.userId, bobSigKey);

		expect(aliceSafetyNumber).not.toBeNull();
		expect(bobSafetyNumber).not.toBeNull();

		// Perfect symmetry between both participants
		expect(aliceSafetyNumber?.numeric).toBe(bobSafetyNumber?.numeric);
		expect(aliceSafetyNumber?.formattedText).toBe(bobSafetyNumber?.formattedText);
		expect(aliceSafetyNumber?.fingerprintHex).toBe(bobSafetyNumber?.fingerprintHex);
		expect(aliceSafetyNumber?.qrPayload).toBe(bobSafetyNumber?.qrPayload);
		expect(aliceSafetyNumber?.numeric).toHaveLength(60);

		// QR verification succeeds
		expect(verifySafetyNumberQr(aliceSafetyNumber!.qrPayload, bobSafetyNumber!)).toBe(true);

		// Alice marks Bob as verified
		aliceTofu.setContactVerified(bob.userId, true);
		expect(aliceTofu.isVerified(bob.userId)).toBe(true);

		// --- Attack / Key Change Simulation ---
		// Suppose Bob's identity key changes (e.g. device replacement or key substitution attack)
		const newBobDevice = DeviceSession.create(bob.userId, `dev_${bob.userId}_2`);
		const fakeBobKp = newBobDevice.generateKeyPackage();

		// Alice creates a new group or member add with new Bob key
		const secondGroup = MlsGroupSession.create(aliceDevice, new TextEncoder().encode('dm_channel_2'));
		secondGroup.addMember(fakeBobKp);

		// Alice checks group members -> key change detected!
		const secondMembers = secondGroup.getMembers();
		const secondResults = aliceTofu.checkGroupMembers(secondMembers);
		expect(secondResults).toHaveLength(1);
		expect(secondResults[0].status).toBe('key_changed');

		// Alice's TOFU flags keyChanged
		expect(aliceTofu.hasKeyChanged(bob.userId)).toBe(true);
		expect(aliceTofu.hasUnacknowledgedKeyChange([bob.userId])).toBe(true);

		// The new safety number with pending key is different from original
		const newSafetyNumber = await aliceTofu.deriveSafetyNumber(bob.userId, aliceSigKey);
		expect(newSafetyNumber?.numeric).not.toBe(aliceSafetyNumber?.numeric);

		// Alice explicitly acknowledges the new key
		const acknowledged = aliceTofu.acknowledgeKeyChange(bob.userId);
		expect(acknowledged).not.toBeNull();
		expect(acknowledged?.keyChanged).toBe(false);
		expect(acknowledged?.verified).toBe(false); // Reset to unverified
		expect(aliceTofu.hasKeyChanged(bob.userId)).toBe(false);
		expect(aliceTofu.isVerified(bob.userId)).toBe(false);
		expect(acknowledged?.previousKeys).toHaveLength(1);
	});
});
