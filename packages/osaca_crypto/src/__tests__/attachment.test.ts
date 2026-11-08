// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {
	AttachmentDigestMismatchError,
	base64ToUint8Array,
	computeSha256Hex,
	decryptAttachmentBytes,
	encryptAttachmentBytes,
	hexToUint8Array,
	uint8ArrayToBase64,
	uint8ArrayToHex,
} from '../attachment.js';

describe('Attachment Cryptography', () => {
	it('converts between Uint8Array and Base64 accurately', () => {
		const bytes = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
		const base64 = uint8ArrayToBase64(bytes);
		const roundtrip = base64ToUint8Array(base64);
		expect(roundtrip).toEqual(bytes);
	});

	it('converts between Uint8Array and Hex accurately', () => {
		const bytes = new Uint8Array([0x0f, 0xaa, 0xde, 0xad, 0xbe, 0xef]);
		const hex = uint8ArrayToHex(bytes);
		expect(hex).toBe('0faadeadbeef');
		const roundtrip = hexToUint8Array(hex);
		expect(roundtrip).toEqual(bytes);
	});

	it('computes correct SHA-256 hex digest', async () => {
		const data = new TextEncoder().encode('Hello world');
		const digest = await computeSha256Hex(data);
		// SHA-256 of "Hello world" is 64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c
		expect(digest).toBe('64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c');
	});

	it('encrypts file bytes so ciphertext does not contain plaintext magic bytes or headers', async () => {
		// Standard PNG magic bytes: 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
		const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const secretPayload = new TextEncoder().encode('CONFIDENTIAL_IMAGE_DATA_PAYLOAD_12345');
		const fakePngFile = new Uint8Array(pngMagic.length + secretPayload.length);
		fakePngFile.set(pngMagic, 0);
		fakePngFile.set(secretPayload, pngMagic.length);

		const result = await encryptAttachmentBytes(fakePngFile);

		expect(result.size).toBe(fakePngFile.length);
		// AES-GCM appends a 16-byte authentication tag
		expect(result.ciphertext_size).toBe(fakePngFile.length + 16);
		expect(result.ciphertext.length).toBe(fakePngFile.length + 16);

		// Assert that ciphertext does NOT start with PNG magic bytes
		expect(result.ciphertext.slice(0, 8)).not.toEqual(pngMagic);

		// Assert that secret plaintext string does NOT appear anywhere in the ciphertext
		const ciphertextString = String.fromCharCode(...result.ciphertext);
		expect(ciphertextString).not.toContain('CONFIDENTIAL');

		// Decrypt and verify exact bit-for-bit recovery
		const decrypted = await decryptAttachmentBytes(result.ciphertext, result.key, result.nonce, result.sha256);
		expect(decrypted).toEqual(fakePngFile);
	});

	it('rejects decryption when SHA-256 digest does not match', async () => {
		const plaintext = new TextEncoder().encode('Sensitive contract text');
		const result = await encryptAttachmentBytes(plaintext);

		const badDigest = '0000000000000000000000000000000000000000000000000000000000000000';
		await expect(decryptAttachmentBytes(result.ciphertext, result.key, result.nonce, badDigest)).rejects.toThrow(
			AttachmentDigestMismatchError,
		);
	});

	it('fails decryption when ciphertext is tampered or corrupted', async () => {
		const plaintext = new TextEncoder().encode('Financial statement');
		const result = await encryptAttachmentBytes(plaintext);

		// Tamper with one byte of ciphertext
		const tampered = new Uint8Array(result.ciphertext);
		tampered[0] ^= 0xff;

		// Without digest check, GCM authentication tag verification will fail
		await expect(decryptAttachmentBytes(tampered, result.key, result.nonce)).rejects.toThrow();
	});

	it('fails decryption when wrong key or nonce is provided', async () => {
		const plaintext = new TextEncoder().encode('Private note');
		const result = await encryptAttachmentBytes(plaintext);

		const wrongKey = uint8ArrayToBase64(new Uint8Array(32).fill(7));
		await expect(decryptAttachmentBytes(result.ciphertext, wrongKey, result.nonce)).rejects.toThrow();

		const wrongNonce = uint8ArrayToBase64(new Uint8Array(12).fill(9));
		await expect(decryptAttachmentBytes(result.ciphertext, result.key, wrongNonce)).rejects.toThrow();
	});
});
