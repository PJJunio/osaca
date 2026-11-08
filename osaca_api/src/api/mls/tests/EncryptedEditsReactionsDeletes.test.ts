// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createDmChannel, createFriendship} from '@app/api/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {DeviceSession, ensureCryptoWasmReady, MlsGroupSession} from '@osaca/crypto';
import type {MessageResponse} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import {
	extractClientMentions,
	formatMlsApplicationPayload,
	type MlsChatMessagePayload,
	type MlsMessageDeletePayload,
	type MlsMessageEditPayload,
	type MlsReactionAddPayload,
	type MlsReactionRemovePayload,
	parseMlsApplicationPayload,
} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';
import type {
	MlsCiphertextHistoryResponse,
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

describe('Encrypted Edits, Reactions, Tombstones and Client Mentions (F1-06)', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		ensureCryptoWasmReady();
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	test('end-to-end encrypted edits, reactions, tombstone deletes, and server ciphertext purging', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		await createFriendship(harness, alice, bob);
		await ensureSessionStarted(harness, alice.token);
		await ensureSessionStarted(harness, bob.token);

		// Setup MLS devices
		const aliceDevice = DeviceSession.create(alice.userId, 'alice_device_1');
		const bobDevice = DeviceSession.create(bob.userId, 'bob_device_1');

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

		// Alice creates DM
		const dm = await createDmChannel(harness, alice.token, bob.userId);
		const channelId = dm.id;

		// Alice claims Bob's KeyPackage and creates MLS Group
		const claim = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
			.post(`/mls/devices/${bob.userId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();

		await createBuilder<MlsGroupResponse>(harness, alice.token)
			.post('/mls/groups')
			.body({group_id: channelId})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		const groupIdBytes = new TextEncoder().encode(channelId);
		const aliceGroup = MlsGroupSession.create(aliceDevice, groupIdBytes);
		const addResult = aliceGroup.addMember(base64ToBytes(claim.key_package));

		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${channelId}/commits`)
			.body({
				epoch: Number(aliceGroup.getEpoch()),
				commit: bytesToBase64(addResult.commit),
				welcome: bytesToBase64(addResult.welcome),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		// Bob fetches Welcome and joins
		const welcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
			.get(`/mls/groups/${channelId}/welcomes/1`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(welcomeRes.welcome));
		expect(Number(bobGroup.getEpoch())).toBe(1);

		// 1. Send initial encrypted chat message from Alice
		const initialChatPayload: MlsChatMessagePayload = {
			version: 1,
			type: 'chat_message',
			content: 'Original message text from Alice',
		};
		const initialPlaintext = formatMlsApplicationPayload(initialChatPayload);
		const initialCiphertext = bytesToBase64(aliceGroup.encryptMessage(new TextEncoder().encode(initialPlaintext)));
		const initialMsgRes = await createBuilder<MessageResponse>(harness, alice.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: initialCiphertext,
				epoch: Number(aliceGroup.getEpoch()),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const originalMessageId = initialMsgRes.id;

		// Bob receives and decrypts initial chat message
		const bobDecryptedInitial = bobGroup.processMessage(base64ToBytes(initialCiphertext));
		expect(bobDecryptedInitial.type).toBe('application');
		if (bobDecryptedInitial.type === 'application') {
			const parsed = parseMlsApplicationPayload(new TextDecoder().decode(bobDecryptedInitial.plaintext));
			expect(parsed.type).toBe('chat_message');
			if (parsed.type === 'chat_message') {
				expect(parsed.content).toBe('Original message text from Alice');
			}
		}

		// 2. Alice sends encrypted message_edit payload
		const editPayload: MlsMessageEditPayload = {
			version: 1,
			type: 'message_edit',
			target_message_id: originalMessageId,
			content: 'Edited message text by Alice',
		};
		const editPlaintext = formatMlsApplicationPayload(editPayload);
		const editCiphertext = bytesToBase64(aliceGroup.encryptMessage(new TextEncoder().encode(editPlaintext)));
		await createBuilder<MessageResponse>(harness, alice.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: editCiphertext,
				epoch: Number(aliceGroup.getEpoch()),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		// Bob decrypts the edit payload
		const bobDecryptedEdit = bobGroup.processMessage(base64ToBytes(editCiphertext));
		expect(bobDecryptedEdit.type).toBe('application');
		if (bobDecryptedEdit.type === 'application') {
			const parsed = parseMlsApplicationPayload(new TextDecoder().decode(bobDecryptedEdit.plaintext));
			expect(parsed.type).toBe('message_edit');
			if (parsed.type === 'message_edit') {
				expect(parsed.target_message_id).toBe(originalMessageId);
				expect(parsed.content).toBe('Edited message text by Alice');
			}
		}

		// 3. Bob sends encrypted reaction_add payload
		const reactionAddPayload: MlsReactionAddPayload = {
			version: 1,
			type: 'reaction_add',
			target_message_id: originalMessageId,
			emoji: {id: null, name: '👍'},
			user_id: bob.userId,
		};
		const reactionAddPlaintext = formatMlsApplicationPayload(reactionAddPayload);
		const reactionAddCiphertext = bytesToBase64(
			bobGroup.encryptMessage(new TextEncoder().encode(reactionAddPlaintext)),
		);
		await createBuilder<MessageResponse>(harness, bob.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: reactionAddCiphertext,
				epoch: Number(bobGroup.getEpoch()),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		// Alice decrypts reaction_add
		const aliceDecryptedReactionAdd = aliceGroup.processMessage(base64ToBytes(reactionAddCiphertext));
		expect(aliceDecryptedReactionAdd.type).toBe('application');
		if (aliceDecryptedReactionAdd.type === 'application') {
			const parsed = parseMlsApplicationPayload(new TextDecoder().decode(aliceDecryptedReactionAdd.plaintext));
			expect(parsed.type).toBe('reaction_add');
			if (parsed.type === 'reaction_add') {
				expect(parsed.target_message_id).toBe(originalMessageId);
				expect(parsed.emoji.name).toBe('👍');
				expect(parsed.user_id).toBe(bob.userId);
			}
		}

		// 4. Bob sends encrypted reaction_remove payload
		const reactionRemovePayload: MlsReactionRemovePayload = {
			version: 1,
			type: 'reaction_remove',
			target_message_id: originalMessageId,
			emoji: {id: null, name: '👍'},
			user_id: bob.userId,
		};
		const reactionRemovePlaintext = formatMlsApplicationPayload(reactionRemovePayload);
		const reactionRemoveCiphertext = bytesToBase64(
			bobGroup.encryptMessage(new TextEncoder().encode(reactionRemovePlaintext)),
		);
		await createBuilder<MessageResponse>(harness, bob.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: reactionRemoveCiphertext,
				epoch: Number(bobGroup.getEpoch()),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		// Alice decrypts reaction_remove
		const aliceDecryptedReactionRemove = aliceGroup.processMessage(base64ToBytes(reactionRemoveCiphertext));
		expect(aliceDecryptedReactionRemove.type).toBe('application');
		if (aliceDecryptedReactionRemove.type === 'application') {
			const parsed = parseMlsApplicationPayload(new TextDecoder().decode(aliceDecryptedReactionRemove.plaintext));
			expect(parsed.type).toBe('reaction_remove');
			if (parsed.type === 'reaction_remove') {
				expect(parsed.target_message_id).toBe(originalMessageId);
				expect(parsed.emoji.name).toBe('👍');
			}
		}

		// 5. Alice sends encrypted message_delete tombstone payload
		const deletePayload: MlsMessageDeletePayload = {
			version: 1,
			type: 'message_delete',
			target_message_id: originalMessageId,
		};
		const deletePlaintext = formatMlsApplicationPayload(deletePayload);
		const deleteCiphertext = bytesToBase64(aliceGroup.encryptMessage(new TextEncoder().encode(deletePlaintext)));
		await createBuilder<MessageResponse>(harness, alice.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: deleteCiphertext,
				epoch: Number(aliceGroup.getEpoch()),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		// Bob decrypts tombstone delete
		const bobDecryptedDelete = bobGroup.processMessage(base64ToBytes(deleteCiphertext));
		expect(bobDecryptedDelete.type).toBe('application');
		if (bobDecryptedDelete.type === 'application') {
			const parsed = parseMlsApplicationPayload(new TextDecoder().decode(bobDecryptedDelete.plaintext));
			expect(parsed.type).toBe('message_delete');
			if (parsed.type === 'message_delete') {
				expect(parsed.target_message_id).toBe(originalMessageId);
			}
		}

		// 6. Alice instructs the Delivery Service to purge the original ciphertext blob
		const purgeRes = await createBuilder<{success: boolean}>(harness, alice.token)
			.delete(`/mls/groups/${channelId}/messages/${originalMessageId}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(purgeRes.success).toBe(true);

		// 7. Verify ciphertext history no longer contains originalMessageId
		const history = await createBuilder<MlsCiphertextHistoryResponse>(harness, bob.token)
			.get(`/mls/groups/${channelId}/messages?member_join_epoch=0`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const historyIds = history.messages.map((m) => m.message_id);
		expect(historyIds).not.toContain(originalMessageId);
	});

	test('computes @mentions on client side upon decrypting incoming MLS message without server content inspection', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);
		await createFriendship(harness, alice, bob);
		await ensureSessionStarted(harness, alice.token);
		await ensureSessionStarted(harness, bob.token);

		const aliceDevice = DeviceSession.create(alice.userId, 'alice_device_m');
		const bobDevice = DeviceSession.create(bob.userId, 'bob_device_m');

		const bobKp = bobDevice.generateKeyPackage();
		await createBuilder<MlsKeyPackagesPublishResponse>(harness, bob.token)
			.post('/mls/key-packages')
			.body({
				device_id: bob.userId,
				key_packages: [bytesToBase64(bobKp)],
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		const dm = await createDmChannel(harness, alice.token, bob.userId);
		const channelId = dm.id;

		const claim = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
			.post(`/mls/devices/${bob.userId}/claim-key-package`)
			.expect(HTTP_STATUS.OK)
			.execute();

		await createBuilder<MlsGroupResponse>(harness, alice.token)
			.post('/mls/groups')
			.body({group_id: channelId})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		const groupIdBytes = new TextEncoder().encode(channelId);
		const aliceGroup = MlsGroupSession.create(aliceDevice, groupIdBytes);
		const addResult = aliceGroup.addMember(base64ToBytes(claim.key_package));

		await createBuilder<MlsCommitResponse>(harness, alice.token)
			.post(`/mls/groups/${channelId}/commits`)
			.body({
				epoch: Number(aliceGroup.getEpoch()),
				commit: bytesToBase64(addResult.commit),
				welcome: bytesToBase64(addResult.welcome),
			})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		const welcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
			.get(`/mls/groups/${channelId}/welcomes/1`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(welcomeRes.welcome));

		// Alice creates an MLS message mentioning Bob and @everyone
		const mentionContent = `Hey <@${bob.userId}>, please review the PR! Also @everyone please attend the standup.`;
		const chatPayload: MlsChatMessagePayload = {
			version: 1,
			type: 'chat_message',
			content: mentionContent,
		};
		const ciphertext = bytesToBase64(
			aliceGroup.encryptMessage(new TextEncoder().encode(formatMlsApplicationPayload(chatPayload))),
		);

		// Post to server: server returns message where content is empty and mentions are empty (no server parsing)
		const serverMsg = await createBuilder<MessageResponse>(harness, alice.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext,
				epoch: Number(aliceGroup.getEpoch()),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(serverMsg.content).toBe('');
		expect(serverMsg.mentions).toEqual([]);
		expect(serverMsg.mention_everyone).toBe(false);

		// Bob decrypts message on the client
		const processed = bobGroup.processMessage(base64ToBytes(ciphertext));
		expect(processed.type).toBe('application');
		if (processed.type === 'application') {
			const parsed = parseMlsApplicationPayload(new TextDecoder().decode(processed.plaintext));
			expect(parsed.type).toBe('chat_message');
			if (parsed.type === 'chat_message') {
				const extracted = extractClientMentions(parsed.content);
				expect(extracted.mentions.some((m) => m.id === bob.userId)).toBe(true);
				expect(extracted.mention_everyone).toBe(true);
			}
		}
	});
});
