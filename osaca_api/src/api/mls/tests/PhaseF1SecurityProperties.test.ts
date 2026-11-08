// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createChannelID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {createDmChannel, createFriendship} from '@app/api/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {getGatewayService, getMlsDeliveryService} from '@app/api/middleware/ServiceRegistry';
import {getChannelRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {
	DeviceSession,
	decryptAttachmentBytes,
	encryptAttachmentBytes,
	ensureCryptoWasmReady,
	MlsGroupSession,
} from '@osaca/crypto';
import type {MessageResponse} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import {
	formatMlsApplicationPayload,
	type MlsChatMessagePayload,
	type MlsEncryptedAttachment,
	type MlsMessageEditPayload,
	type MlsReactionAddPayload,
	parseMlsApplicationPayload,
} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';
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

function safeJsonStringify(obj: unknown): string {
	return JSON.stringify(obj, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

describe('Phase F1 Security Property Tests (osaca_api)', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		ensureCryptoWasmReady();
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	describe('Security Property 1: No Plaintext on the Wire or in Storage (ADR-0008, ADR-0016)', () => {
		test('guarantees no plaintext or filenames appear in HTTP, Gateway, S3, or database storage across messages, edits, reactions, and attachments', async () => {
			const alice = await createTestAccount(harness);
			const bob = await createTestAccount(harness);
			await createFriendship(harness, alice, bob);
			await ensureSessionStarted(harness, alice.token);
			await ensureSessionStarted(harness, bob.token);

			// Setup MLS cryptographic device sessions for Alice and Bob
			const aliceDevice = DeviceSession.create(alice.userId, 'alice_device_f1');
			const bobDevice = DeviceSession.create(bob.userId, 'bob_device_f1');

			// Bob publishes pre-generated KeyPackages to the Delivery Service
			const bobKp = bobDevice.generateKeyPackage();
			await createBuilder<MlsKeyPackagesPublishResponse>(harness, bob.token)
				.post('/mls/key-packages')
				.body({
					device_id: bob.userId,
					key_packages: [bytesToBase64(bobKp)],
				})
				.expect(HTTP_STATUS.CREATED)
				.execute();

			// Alice creates DM channel
			const dm = await createDmChannel(harness, alice.token, bob.userId);
			const channelId = dm.id;

			// Alice claims Bob's KeyPackage and registers the MLS Group on server
			const claim = await createBuilder<MlsClaimKeyPackageResponse>(harness, alice.token)
				.post(`/mls/devices/${bob.userId}/claim-key-package`)
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder<MlsGroupResponse>(harness, alice.token)
				.post('/mls/groups')
				.body({group_id: channelId})
				.expect(HTTP_STATUS.CREATED)
				.execute();

			// Alice establishes group session and adds Bob
			const groupIdBytes = new TextEncoder().encode(channelId);
			const aliceGroup = MlsGroupSession.create(aliceDevice, groupIdBytes);
			const addResult = aliceGroup.addMember(base64ToBytes(claim.key_package));

			// Alice posts Commit & Welcome to Delivery Service
			await createBuilder<MlsCommitResponse>(harness, alice.token)
				.post(`/mls/groups/${channelId}/commits`)
				.body({
					epoch: Number(aliceGroup.getEpoch()),
					commit: bytesToBase64(addResult.commit),
					welcome: bytesToBase64(addResult.welcome),
				})
				.expect(HTTP_STATUS.CREATED)
				.execute();

			// Bob fetches Welcome and joins MLS group session
			const welcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
				.get(`/mls/groups/${channelId}/welcomes/1`)
				.expect(HTTP_STATUS.OK)
				.execute();
			const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(welcomeRes.welcome));
			expect(Number(bobGroup.getEpoch())).toBe(1);

			// Intercept and monitor Gateway presence dispatches
			const gateway = getGatewayService();
			const dispatchedPresenceEvents: Array<unknown> = [];
			vi.spyOn(gateway, 'dispatchPresence').mockImplementation(async (event) => {
				dispatchedPresenceEvents.push(event);
			});

			// Define high-entropy Canary secrets that MUST NEVER appear on wire or in server storage
			const CANARY_MESSAGE_PLAINTEXT = 'CONFIDENTIAL_ALPHA_CANARY_E2EE_MESSAGE_987123';
			const CANARY_EDIT_PLAINTEXT = 'CONFIDENTIAL_BETA_CANARY_E2EE_EDITED_TEXT_654321';
			const CANARY_REACTION_EMOJI = 'SECRET_GAMMA_CANARY_REACTION_333444';
			const CANARY_ATTACHMENT_FILENAME = 'canary_classified_payroll_2026.pdf';
			const CANARY_ATTACHMENT_CONTENT = 'CANARY_DELTA_BIOMETRIC_ATTACHMENT_STREAM_888999';

			const allCanaries = [
				CANARY_MESSAGE_PLAINTEXT,
				CANARY_EDIT_PLAINTEXT,
				CANARY_REACTION_EMOJI,
				CANARY_ATTACHMENT_FILENAME,
				CANARY_ATTACHMENT_CONTENT,
			];

			const httpResponsesCollected: Array<string> = [];

			// 1. Alice sends Encrypted Message containing CANARY_MESSAGE_PLAINTEXT
			const chatPayload: MlsChatMessagePayload = {
				version: 1,
				type: 'chat_message',
				content: CANARY_MESSAGE_PLAINTEXT,
			};
			const chatPlaintextStr = formatMlsApplicationPayload(chatPayload);
			const chatCiphertextBytes = aliceGroup.encryptMessage(new TextEncoder().encode(chatPlaintextStr));
			const chatCiphertextBase64 = bytesToBase64(chatCiphertextBytes);

			const sendMsgRes = await createBuilder<MessageResponse>(harness, alice.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					ciphertext: chatCiphertextBase64,
					epoch: Number(aliceGroup.getEpoch()),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			httpResponsesCollected.push(JSON.stringify(sendMsgRes));
			const originalMsgId = sendMsgRes.id;

			// 2. Alice sends Encrypted Edit containing CANARY_EDIT_PLAINTEXT
			const editPayload: MlsMessageEditPayload = {
				version: 1,
				type: 'message_edit',
				target_message_id: originalMsgId,
				content: CANARY_EDIT_PLAINTEXT,
			};
			const editPlaintextStr = formatMlsApplicationPayload(editPayload);
			const editCiphertextBytes = aliceGroup.encryptMessage(new TextEncoder().encode(editPlaintextStr));
			const editCiphertextBase64 = bytesToBase64(editCiphertextBytes);

			const sendEditRes = await createBuilder<MessageResponse>(harness, alice.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					ciphertext: editCiphertextBase64,
					epoch: Number(aliceGroup.getEpoch()),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			httpResponsesCollected.push(JSON.stringify(sendEditRes));

			// 3. Bob sends Encrypted Reaction containing CANARY_REACTION_EMOJI
			const reactionPayload: MlsReactionAddPayload = {
				version: 1,
				type: 'reaction_add',
				target_message_id: originalMsgId,
				emoji: {id: null, name: CANARY_REACTION_EMOJI},
				user_id: bob.userId,
			};
			const reactionPlaintextStr = formatMlsApplicationPayload(reactionPayload);
			const reactionCiphertextBytes = bobGroup.encryptMessage(new TextEncoder().encode(reactionPlaintextStr));
			const reactionCiphertextBase64 = bytesToBase64(reactionCiphertextBytes);

			const sendReactionRes = await createBuilder<MessageResponse>(harness, bob.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					ciphertext: reactionCiphertextBase64,
					epoch: Number(bobGroup.getEpoch()),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			httpResponsesCollected.push(JSON.stringify(sendReactionRes));

			// 4. Alice client-encrypts an Attachment with CANARY_ATTACHMENT_FILENAME & CANARY_ATTACHMENT_CONTENT
			const rawAttachmentBytes = new TextEncoder().encode(CANARY_ATTACHMENT_CONTENT);
			const encryptedAttachment = await encryptAttachmentBytes(rawAttachmentBytes);

			// The upload filename used in HTTP presigned URL request is strictly opaque
			const opaqueStorageKey = `enc_${crypto.randomUUID().slice(0, 12)}.bin`;
			const presignedRes = await createBuilder<{
				attachments: Array<{
					id: number | string;
					upload_filename: string;
					upload_url: string;
				}>;
			}>(harness, alice.token)
				.post(`/channels/${channelId}/attachments`)
				.body({
					attachments: [
						{
							id: 1,
							filename: opaqueStorageKey,
							file_size: encryptedAttachment.ciphertext.byteLength,
							content_type: 'application/octet-stream',
						},
					],
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			httpResponsesCollected.push(JSON.stringify(presignedRes));

			const uploadPlan = presignedRes.attachments[0];
			expect(uploadPlan).toBeDefined();

			// Store the opaque ciphertext blob to S3/Storage
			await harness.storageService.uploadObject({
				bucket: Config.s3.buckets.uploads,
				key: uploadPlan!.upload_filename,
				body: Buffer.from(encryptedAttachment.ciphertext),
				contentType: 'application/octet-stream',
			});

			// Alice packages real filename, symmetric key, nonce, and hash INSIDE the MLS application payload
			const encryptedAttachmentMeta: MlsEncryptedAttachment = {
				id: 'att_1',
				filename: CANARY_ATTACHMENT_FILENAME,
				size: encryptedAttachment.size,
				ciphertext_size: encryptedAttachment.ciphertext_size,
				content_type: 'application/pdf',
				key: encryptedAttachment.key,
				nonce: encryptedAttachment.nonce,
				sha256: encryptedAttachment.sha256,
				upload_filename: uploadPlan!.upload_filename,
			};

			const attachmentMessagePayload: MlsChatMessagePayload = {
				version: 1,
				type: 'chat_message',
				content: '',
				attachments: [encryptedAttachmentMeta],
			};

			const attachmentMsgPlaintextStr = formatMlsApplicationPayload(attachmentMessagePayload);
			const attachmentMsgCiphertextBytes = aliceGroup.encryptMessage(
				new TextEncoder().encode(attachmentMsgPlaintextStr),
			);
			const attachmentMsgCiphertextBase64 = bytesToBase64(attachmentMsgCiphertextBytes);

			const sendAttachmentMsgRes = await createBuilder<MessageResponse>(harness, alice.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					ciphertext: attachmentMsgCiphertextBase64,
					epoch: Number(aliceGroup.getEpoch()),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			httpResponsesCollected.push(JSON.stringify(sendAttachmentMsgRes));

			// =========================================================================
			// SECURITY PROPERTY 1 ASSERTIONS: NO PLAINTEXT ON WIRE OR IN STORAGE
			// =========================================================================

			// Assertion 1: No canary token ever appears in any HTTP response body
			for (const canary of allCanaries) {
				for (const resBody of httpResponsesCollected) {
					expect(resBody).not.toContain(canary);
				}
			}

			// Assertion 2: No canary token ever appears in Gateway presence frames
			const gatewaySerialized = safeJsonStringify(dispatchedPresenceEvents);
			for (const canary of allCanaries) {
				expect(gatewaySerialized).not.toContain(canary);
			}

			// Assertion 3: No canary token appears in MLS Delivery Service stored ciphertext history
			const deliveryService = getMlsDeliveryService();
			const storedCiphertexts = await deliveryService.getCiphertextHistory(channelId, 0);
			const historySerialized = safeJsonStringify(storedCiphertexts);
			for (const canary of allCanaries) {
				expect(historySerialized).not.toContain(canary);
			}

			// Assertion 4: No canary token appears in the Channel / Message database repository
			const channelRepo = getChannelRepository();
			const dbMessages = await channelRepo.messages.listMessages(createChannelID(BigInt(channelId)));
			const dbSerialized = safeJsonStringify(dbMessages);
			for (const canary of allCanaries) {
				expect(dbSerialized).not.toContain(canary);
			}

			// Also fetch messages via HTTP API and assert no canary appears
			const httpMessagesRes = await createBuilder<Array<MessageResponse>>(harness, bob.token)
				.get(`/channels/${channelId}/messages`)
				.expect(HTTP_STATUS.OK)
				.execute();
			const httpMessagesSerialized = safeJsonStringify(httpMessagesRes);
			for (const canary of allCanaries) {
				expect(httpMessagesSerialized).not.toContain(canary);
			}

			// Assertion 5: No canary token or filename appears in S3 Storage (keys, headers, or data)
			const s3Objects = (harness.storageService as unknown as {objects: Map<string, {data: Uint8Array}>}).objects;
			for (const [key, storedObj] of s3Objects.entries()) {
				for (const canary of allCanaries) {
					expect(key).not.toContain(canary);
					const dataStr = new TextDecoder().decode(storedObj.data);
					expect(dataStr).not.toContain(canary);
				}
			}

			// =========================================================================
			// RECIPIENT RECOVERY ASSERTION: Legitimate recipient Bob can decrypt everything
			// =========================================================================

			// Bob decrypts Chat Message
			const bobDecryptedMsg = bobGroup.processMessage(chatCiphertextBytes);
			expect(bobDecryptedMsg.type).toBe('application');
			if (bobDecryptedMsg.type === 'application') {
				const parsed = parseMlsApplicationPayload(new TextDecoder().decode(bobDecryptedMsg.plaintext));
				expect(parsed.type).toBe('chat_message');
				if (parsed.type === 'chat_message') {
					expect(parsed.content).toBe(CANARY_MESSAGE_PLAINTEXT);
				}
			}

			// Bob decrypts Edit
			const bobDecryptedEdit = bobGroup.processMessage(editCiphertextBytes);
			expect(bobDecryptedEdit.type).toBe('application');
			if (bobDecryptedEdit.type === 'application') {
				const parsed = parseMlsApplicationPayload(new TextDecoder().decode(bobDecryptedEdit.plaintext));
				expect(parsed.type).toBe('message_edit');
				if (parsed.type === 'message_edit') {
					expect(parsed.content).toBe(CANARY_EDIT_PLAINTEXT);
				}
			}

			// Alice decrypts Reaction sent by Bob
			const aliceDecryptedReaction = aliceGroup.processMessage(reactionCiphertextBytes);
			expect(aliceDecryptedReaction.type).toBe('application');
			if (aliceDecryptedReaction.type === 'application') {
				const parsed = parseMlsApplicationPayload(new TextDecoder().decode(aliceDecryptedReaction.plaintext));
				expect(parsed.type).toBe('reaction_add');
				if (parsed.type === 'reaction_add') {
					expect(parsed.emoji.name).toBe(CANARY_REACTION_EMOJI);
				}
			}

			// Bob decrypts Attachment Message & Attachment Bytes
			const bobDecryptedAttMsg = bobGroup.processMessage(attachmentMsgCiphertextBytes);
			expect(bobDecryptedAttMsg.type).toBe('application');
			if (bobDecryptedAttMsg.type === 'application') {
				const parsed = parseMlsApplicationPayload(new TextDecoder().decode(bobDecryptedAttMsg.plaintext));
				expect(parsed.type).toBe('chat_message');
				if (parsed.type === 'chat_message') {
					const att = parsed.attachments?.[0];
					expect(att).toBeDefined();
					expect(att?.filename).toBe(CANARY_ATTACHMENT_FILENAME);

					// Bob retrieves the opaque ciphertext from storage
					const attCiphertext = await harness.storageService.readObject(
						Config.s3.buckets.uploads,
						att!.upload_filename!,
					);

					// Bob decrypts the attachment locally
					const decryptedFileBytes = await decryptAttachmentBytes(attCiphertext, att!.key, att!.nonce, att!.sha256);
					const recoveredFileContent = new TextDecoder().decode(decryptedFileBytes);
					expect(recoveredFileContent).toBe(CANARY_ATTACHMENT_CONTENT);
				}
			}
		});
	});

	describe('Security Property 2: Epoch Monotonicity and Commit Conflict Rejection (ADR-0004, ADR-0016)', () => {
		test('submitting two concurrent Commits for the same (group_id, epoch) results in exactly one accepted Commit and one rejected conflict', async () => {
			const account = await createTestAccount(harness);
			const groupId = 'group_race_test_epoch';

			// Register MLS Group (initial epoch 0)
			await createBuilder<MlsGroupResponse>(harness, account.token)
				.post('/mls/groups')
				.body({group_id: groupId})
				.expect(HTTP_STATUS.CREATED)
				.execute();

			const commitA = Buffer.from('commit_payload_candidate_A').toString('base64');
			const commitB = Buffer.from('commit_payload_candidate_B').toString('base64');

			// Send two concurrent commits competing for epoch 1
			const [resA, resB] = await Promise.all([
				harness.requestJson({
					path: `/mls/groups/${groupId}/commits`,
					method: 'POST',
					body: {epoch: 1, commit: commitA},
					headers: {Authorization: account.token},
				}),
				harness.requestJson({
					path: `/mls/groups/${groupId}/commits`,
					method: 'POST',
					body: {epoch: 1, commit: commitB},
					headers: {Authorization: account.token},
				}),
			]);

			// Exactly one must succeed (201 Created) and one must be rejected (409 Conflict)
			const statuses = [resA.status, resB.status];
			expect(statuses.filter((s) => s === 201)).toHaveLength(1);
			expect(statuses.filter((s) => s === 409)).toHaveLength(1);

			// The current_epoch in group must now be 1
			const groupAfterConflict = await createBuilder<MlsGroupResponse>(harness, account.token)
				.get(`/mls/groups/${groupId}`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(groupAfterConflict.current_epoch).toBe(1);

			// Duplicate commit targeting already-applied epoch 1 fails with 409 Conflict & MLS_EPOCH_CONFLICT
			const duplicateConflict = await createBuilder(harness, account.token)
				.post(`/mls/groups/${groupId}/commits`)
				.body({epoch: 1, commit: commitA})
				.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.MLS_EPOCH_CONFLICT)
				.executeWithResponse();

			const errorJson = duplicateConflict.json as {code: string; current_epoch: number; requested_epoch: number};
			expect(errorJson.code).toBe(APIErrorCodes.MLS_EPOCH_CONFLICT);
			expect(errorJson.current_epoch).toBe(1);
			expect(errorJson.requested_epoch).toBe(1);
		});

		test('rejects stale and out-of-order skipped commits with 409 Conflict', async () => {
			const account = await createTestAccount(harness);
			const groupId = 'group_epoch_order_test';

			await createBuilder<MlsGroupResponse>(harness, account.token)
				.post('/mls/groups')
				.body({group_id: groupId})
				.expect(HTTP_STATUS.CREATED)
				.execute();

			// 1. Advance to epoch 1
			await createBuilder<MlsCommitResponse>(harness, account.token)
				.post(`/mls/groups/${groupId}/commits`)
				.body({
					epoch: 1,
					commit: Buffer.from('commit_1').toString('base64'),
				})
				.expect(HTTP_STATUS.CREATED)
				.execute();

			// 2. Stale commit: Attempting to commit for epoch 0 (less than current + 1)
			const staleRes = await createBuilder(harness, account.token)
				.post(`/mls/groups/${groupId}/commits`)
				.body({
					epoch: 0,
					commit: Buffer.from('stale_commit_0').toString('base64'),
				})
				.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.MLS_EPOCH_CONFLICT)
				.executeWithResponse();

			const staleJson = staleRes.json as {code: string; current_epoch: number; requested_epoch: number};
			expect(staleJson.code).toBe(APIErrorCodes.MLS_EPOCH_CONFLICT);
			expect(staleJson.current_epoch).toBe(1);
			expect(staleJson.requested_epoch).toBe(0);

			// 3. Skipped commit: Attempting to commit for epoch 4 (skipping epochs 2 and 3)
			const skippedRes = await createBuilder(harness, account.token)
				.post(`/mls/groups/${groupId}/commits`)
				.body({
					epoch: 4,
					commit: Buffer.from('skipped_commit_4').toString('base64'),
				})
				.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.MLS_EPOCH_CONFLICT)
				.executeWithResponse();

			const skippedJson = skippedRes.json as {code: string; current_epoch: number; requested_epoch: number};
			expect(skippedJson.code).toBe(APIErrorCodes.MLS_EPOCH_CONFLICT);
			expect(skippedJson.current_epoch).toBe(1);
			expect(skippedJson.requested_epoch).toBe(4);

			// 4. Sequential commits: strictly monotonic progression succeeds
			const epoch2 = await createBuilder<MlsCommitResponse>(harness, account.token)
				.post(`/mls/groups/${groupId}/commits`)
				.body({
					epoch: 2,
					commit: Buffer.from('commit_2').toString('base64'),
				})
				.expect(HTTP_STATUS.CREATED)
				.execute();
			expect(epoch2.epoch).toBe(2);

			const epoch3 = await createBuilder<MlsCommitResponse>(harness, account.token)
				.post(`/mls/groups/${groupId}/commits`)
				.body({
					epoch: 3,
					commit: Buffer.from('commit_3').toString('base64'),
				})
				.expect(HTTP_STATUS.CREATED)
				.execute();
			expect(epoch3.epoch).toBe(3);

			// Final group epoch must be 3
			const finalGroup = await createBuilder<MlsGroupResponse>(harness, account.token)
				.get(`/mls/groups/${groupId}`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(finalGroup.current_epoch).toBe(3);
		});
	});
});
