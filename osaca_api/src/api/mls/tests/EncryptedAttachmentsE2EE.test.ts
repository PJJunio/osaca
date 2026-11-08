// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {Config} from '@app/api/Config';
import {createDmChannel, createFriendship} from '@app/api/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {
	AttachmentDigestMismatchError,
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
	type MlsLinkPreview,
	parseMlsApplicationPayload,
} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';
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

describe('Client-Encrypted Attachments and Sender-Side Link Previews (F1-07)', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		ensureCryptoWasmReady();
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	test('end-to-end client-encrypted attachment and sender-side link preview flow', async () => {
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

		// Alice creates DM channel
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

		// Bob fetches Welcome and joins MLS Group
		const welcomeRes = await createBuilder<MlsWelcomeDetailResponse>(harness, bob.token)
			.get(`/mls/groups/${channelId}/welcomes/1`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, base64ToBytes(welcomeRes.welcome));
		expect(Number(bobGroup.getEpoch())).toBe(1);

		// --- Alice prepares client-encrypted attachment ---
		// Plaintext file: PNG image with standard magic bytes
		const pngMagicBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const filePayload = new TextEncoder().encode('SECRET_FINANCIAL_REPORT_2026_CONFIDENTIAL_DATA');
		const originalFileBytes = new Uint8Array(pngMagicBytes.length + filePayload.length);
		originalFileBytes.set(pngMagicBytes, 0);
		originalFileBytes.set(filePayload, pngMagicBytes.length);

		// Alice generates symmetric key and encrypts attachment locally
		const encryptedAttachment = await encryptAttachmentBytes(originalFileBytes);
		const opaqueFilename = `enc_${crypto.randomUUID().slice(0, 8)}.bin`;

		// Verify client ciphertext does NOT match plaintext magic bytes or content
		expect(encryptedAttachment.ciphertext.slice(0, 8)).not.toEqual(pngMagicBytes);
		expect(new TextDecoder().decode(encryptedAttachment.ciphertext)).not.toContain('SECRET_FINANCIAL_REPORT');

		// Alice requests presigned upload URL for the opaque ciphertext
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
						filename: opaqueFilename,
						file_size: encryptedAttachment.ciphertext.length,
						content_type: 'application/octet-stream',
					},
				],
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const uploadPlan = presignedRes.attachments[0];
		expect(uploadPlan).toBeDefined();
		const uploadFilename = uploadPlan.upload_filename;

		// Alice uploads the opaque ciphertext blob to storage
		await harness.storageService.uploadObject({
			bucket: Config.s3.buckets.uploads,
			key: uploadFilename,
			body: encryptedAttachment.ciphertext,
			contentType: 'application/octet-stream',
		});

		// Verify S3 storage only has opaque ciphertext bytes
		const s3UploadedBytes = await harness.storageService.readObject(Config.s3.buckets.uploads, uploadFilename);
		expect(s3UploadedBytes).toEqual(encryptedAttachment.ciphertext);
		expect(s3UploadedBytes.slice(0, 8)).not.toEqual(pngMagicBytes);

		// Alice prepares MLS application message with attachment key, sha256 digest, and opt-in sender link preview
		const encryptedAttachmentMetadata: MlsEncryptedAttachment = {
			id: '1',
			filename: 'secret_report.png',
			content_type: 'image/png',
			size: originalFileBytes.length,
			ciphertext_size: encryptedAttachment.ciphertext.length,
			sha256: encryptedAttachment.sha256,
			key: encryptedAttachment.key,
			nonce: encryptedAttachment.nonce,
			upload_filename: uploadFilename,
			width: 1920,
			height: 1080,
			thumbhash: '1QcSHQR3d3d/h4eAeIePh/8=',
		};

		const senderLinkPreview: MlsLinkPreview = {
			url: 'https://internal.osaca.dev/reports/f1-07',
			title: 'OSACA E2EE Design Specification',
			description: 'Opt-in sender-side fetched preview metadata with no server leakage',
			site_name: 'OSACA Docs',
		};

		const chatPayload: MlsChatMessagePayload = {
			version: 1,
			type: 'chat_message',
			content: 'Here is the client-encrypted attachment and confidential link',
			attachments: [encryptedAttachmentMetadata],
			previews: [senderLinkPreview],
		};

		const mlsPlaintext = formatMlsApplicationPayload(chatPayload);
		const mlsCiphertext = bytesToBase64(aliceGroup.encryptMessage(new TextEncoder().encode(mlsPlaintext)));

		// Alice sends the message to the channel
		const messageRes = await createBuilder<MessageResponse>(harness, alice.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				ciphertext: mlsCiphertext,
				epoch: Number(aliceGroup.getEpoch()),
				attachments: [
					{
						id: 1,
						filename: opaqueFilename,
						upload_filename: uploadFilename,
						content_type: 'application/octet-stream',
						file_size: encryptedAttachment.ciphertext.length,
					},
				],
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(messageRes.attachments).toHaveLength(1);
		const wireAttachment = messageRes.attachments![0]!;
		// Wire attachment exposes only opaque bin name and octet-stream to server
		expect(wireAttachment.filename).toBe(opaqueFilename);
		expect(wireAttachment.content_type).toBe('application/octet-stream');

		// Verify CDN storage key holds the ciphertext, NOT plaintext
		const cdnKey = `attachments/${channelId}/${wireAttachment.id}/${opaqueFilename}`;
		const cdnStoredBytes = await harness.storageService.readObject(Config.s3.buckets.cdn, cdnKey);
		expect(cdnStoredBytes).toEqual(encryptedAttachment.ciphertext);
		expect(cdnStoredBytes.slice(0, 8)).not.toEqual(pngMagicBytes);
		expect(new TextDecoder().decode(cdnStoredBytes)).not.toContain('SECRET_FINANCIAL_REPORT');

		// --- Bob receives and decrypts message and attachment ---
		const bobDecrypted = bobGroup.processMessage(base64ToBytes(mlsCiphertext));
		expect(bobDecrypted.type).toBe('application');
		if (bobDecrypted.type !== 'application') return;

		const parsedPayload = parseMlsApplicationPayload(new TextDecoder().decode(bobDecrypted.plaintext));
		expect(parsedPayload.type).toBe('chat_message');
		if (parsedPayload.type !== 'chat_message') return;

		expect(parsedPayload.content).toBe('Here is the client-encrypted attachment and confidential link');
		expect(parsedPayload.attachments).toHaveLength(1);
		expect(parsedPayload.previews).toHaveLength(1);

		const receivedAttachment = parsedPayload.attachments![0];
		expect(receivedAttachment.filename).toBe('secret_report.png');
		expect(receivedAttachment.content_type).toBe('image/png');
		expect(receivedAttachment.size).toBe(originalFileBytes.length);
		expect(receivedAttachment.width).toBe(1920);
		expect(receivedAttachment.height).toBe(1080);
		expect(receivedAttachment.thumbhash).toBe('1QcSHQR3d3d/h4eAeIePh/8=');

		const receivedPreview = parsedPayload.previews![0];
		expect(receivedPreview.url).toBe('https://internal.osaca.dev/reports/f1-07');
		expect(receivedPreview.title).toBe('OSACA E2EE Design Specification');
		expect(receivedPreview.site_name).toBe('OSACA Docs');

		// Bob fetches opaque blob from storage and verifies digest before local decryption
		const bobFetchedBlob = await harness.storageService.readObject(Config.s3.buckets.cdn, cdnKey);
		const decryptedFileBytes = await decryptAttachmentBytes(
			bobFetchedBlob,
			receivedAttachment.key,
			receivedAttachment.nonce,
			receivedAttachment.sha256,
		);

		// Bob recovered the exact original PNG file
		expect(decryptedFileBytes).toEqual(originalFileBytes);
		expect(decryptedFileBytes.slice(0, 8)).toEqual(pngMagicBytes);
		expect(new TextDecoder().decode(decryptedFileBytes)).toContain('SECRET_FINANCIAL_REPORT_2026_CONFIDENTIAL_DATA');
	});

	test('tampered ciphertext in storage causes local digest verification failure', async () => {
		const originalData = new TextEncoder().encode('Integrity verified file contents');
		const encrypted = await encryptAttachmentBytes(originalData);

		// Attacker tampers with 1 byte in ciphertext
		const tamperedCiphertext = new Uint8Array(encrypted.ciphertext);
		tamperedCiphertext[0] ^= 0xff;

		// Local decryption with expected digest rejects the tampered ciphertext
		await expect(
			decryptAttachmentBytes(tamperedCiphertext, encrypted.key, encrypted.nonce, encrypted.sha256),
		).rejects.toThrow(AttachmentDigestMismatchError);
	});
});
