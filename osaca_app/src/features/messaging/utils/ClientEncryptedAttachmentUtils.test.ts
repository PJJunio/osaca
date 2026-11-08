// SPDX-License-Identifier: AGPL-3.0-or-later

import {beforeAll, describe, expect, it} from 'vitest';
import {
	decryptClientAttachmentBlob,
	encryptClientAttachment,
	getCachedDecryptedAttachmentUrl,
	readFileAsUint8Array,
} from './ClientEncryptedAttachmentUtils';

describe('ClientEncryptedAttachmentUtils', () => {
	beforeAll(() => {
		if (typeof URL.createObjectURL === 'undefined') {
			URL.createObjectURL = (_blob: Blob) => `blob:mock-url-${Math.random()}`;
		}
		if (typeof URL.revokeObjectURL === 'undefined') {
			URL.revokeObjectURL = () => {};
		}
	});

	it('encrypts a client file into an opaque ciphertext File with metadata', async () => {
		const originalText = 'Highly confidential financial forecast 2027';
		const plaintextBytes = new TextEncoder().encode(originalText);
		const file = new File([plaintextBytes], 'confidential_forecast.csv', {type: 'text/csv'});

		const prepared = await encryptClientAttachment(file, {id: 'test-att-1', generateThumbnail: false});

		expect(prepared.encryptedFile.name).toMatch(/^enc_\d+_[a-z0-9]+\.bin$/);
		expect(prepared.encryptedFile.type).toBe('application/octet-stream');
		expect(prepared.metadata.filename).toBe('confidential_forecast.csv');
		expect(prepared.metadata.content_type).toBe('text/csv');
		expect(prepared.metadata.size).toBe(plaintextBytes.length);
		expect(prepared.metadata.ciphertext_size).toBe(plaintextBytes.length + 16);
		expect(prepared.metadata.sha256).toHaveLength(64);

		// Assert ciphertext bytes do NOT contain the plaintext
		const cipherBytes = await readFileAsUint8Array(prepared.encryptedFile);
		const cipherStr = String.fromCharCode(...cipherBytes);
		expect(cipherStr).not.toContain('confidential');

		// Decrypt and verify
		const decrypted = await decryptClientAttachmentBlob(cipherBytes, prepared.metadata);
		const recoveredText = new TextDecoder().decode(await readFileAsUint8Array(decrypted.blob));
		expect(recoveredText).toBe(originalText);
		expect(decrypted.blob.type).toBe('text/csv');
		expect(decrypted.objectUrl).toBeDefined();

		// Check cache
		expect(getCachedDecryptedAttachmentUrl(prepared.metadata.sha256)).toBe(decrypted.objectUrl);
	});

	it('rejects decryption when ciphertext has been modified or corrupted', async () => {
		const file = new File([new TextEncoder().encode('Hello')], 'hello.txt', {type: 'text/plain'});
		const prepared = await encryptClientAttachment(file, {id: 'tamper-1', generateThumbnail: false});

		const cipherBytes = await readFileAsUint8Array(prepared.encryptedFile);
		cipherBytes[0] ^= 0xff; // corrupt first byte

		await expect(decryptClientAttachmentBlob(cipherBytes, prepared.metadata)).rejects.toThrow();
	});
});
