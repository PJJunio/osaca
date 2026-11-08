// SPDX-License-Identifier: AGPL-3.0-or-later

export class AttachmentDigestMismatchError extends Error {
	constructor(expected: string, actual: string) {
		super(`Attachment SHA-256 digest mismatch: expected ${expected}, got ${actual}`);
		this.name = 'AttachmentDigestMismatchError';
	}
}

export interface EncryptedAttachmentResult {
	ciphertext: Uint8Array;
	key: string;
	nonce: string;
	sha256: string;
	size: number;
	ciphertext_size: number;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		const buf = Buffer.from(base64, 'base64');
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	}
	const binary = atob(base64);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
	const cleanHex = hex.trim().toLowerCase();
	if (cleanHex.length % 2 !== 0) {
		throw new Error('Hex string must have an even length');
	}
	const bytes = new Uint8Array(cleanHex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

export async function computeSha256Hex(data: Uint8Array): Promise<string> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error('WebCrypto subtle is not available in the current environment');
	}
	const hashBuffer = await subtle.digest('SHA-256', data as any);
	return uint8ArrayToHex(new Uint8Array(hashBuffer));
}

export async function encryptAttachmentBytes(
	plaintext: Uint8Array,
	options?: {
		key?: Uint8Array;
		nonce?: Uint8Array;
	},
): Promise<EncryptedAttachmentResult> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error('WebCrypto subtle is not available in the current environment');
	}

	const rawKey = options?.key ?? globalThis.crypto.getRandomValues(new Uint8Array(32));
	const iv = options?.nonce ?? globalThis.crypto.getRandomValues(new Uint8Array(12));

	const cryptoKey = await subtle.importKey('raw', rawKey as any, {name: 'AES-GCM'}, false, ['encrypt']);
	const ciphertextBuffer = await subtle.encrypt({name: 'AES-GCM', iv: iv as any}, cryptoKey, plaintext as any);
	const ciphertext = new Uint8Array(ciphertextBuffer);

	const sha256 = await computeSha256Hex(ciphertext);

	return {
		ciphertext,
		key: uint8ArrayToBase64(rawKey),
		nonce: uint8ArrayToBase64(iv),
		sha256,
		size: plaintext.byteLength,
		ciphertext_size: ciphertext.byteLength,
	};
}

export async function decryptAttachmentBytes(
	ciphertext: Uint8Array,
	keyBase64: string,
	nonceBase64: string,
	expectedSha256?: string,
): Promise<Uint8Array> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error('WebCrypto subtle is not available in the current environment');
	}

	if (expectedSha256) {
		const actualSha256 = await computeSha256Hex(ciphertext);
		if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
			throw new AttachmentDigestMismatchError(expectedSha256, actualSha256);
		}
	}

	const rawKey = base64ToUint8Array(keyBase64);
	const iv = base64ToUint8Array(nonceBase64);

	const cryptoKey = await subtle.importKey('raw', rawKey as any, {name: 'AES-GCM'}, false, ['decrypt']);
	const decryptedBuffer = await subtle.decrypt({name: 'AES-GCM', iv: iv as any}, cryptoKey, ciphertext as any);

	return new Uint8Array(decryptedBuffer);
}
