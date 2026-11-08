// SPDX-License-Identifier: AGPL-3.0-or-later

import {hexToUint8Array, uint8ArrayToHex} from './attachment.js';

export interface SafetyNumberParticipant {
	accountId: string;
	publicKey: Uint8Array | string;
}

export interface SafetyNumberQrPayload {
	scheme: 'osaca-safety-number';
	version: 1;
	fingerprint: string;
	numeric: string;
	accounts: [string, string];
}

export interface SafetyNumber {
	/** Formatted 60-digit string: 12 blocks of 5 digits separated by spaces */
	formattedText: string;
	/** Raw 60 digits without spaces */
	numeric: string;
	/** Deterministic scannable QR code payload (JSON) */
	qrPayload: string;
	/** Hex-encoded SHA-256 fingerprint hash over canonical participant keys */
	fingerprintHex: string;
	/** The two sorted participants in canonical comparison order */
	participants: [{accountId: string; publicKeyHex: string}, {accountId: string; publicKeyHex: string}];
}

function normalizeKey(key: Uint8Array | string): {bytes: Uint8Array; hex: string} {
	if (typeof key === 'string') {
		const clean = key.trim().toLowerCase();
		return {bytes: hexToUint8Array(clean), hex: clean};
	}
	return {bytes: key, hex: uint8ArrayToHex(key)};
}

function compareParticipants(a: {accountId: string; hex: string}, b: {accountId: string; hex: string}): number {
	const idCmp = a.accountId.localeCompare(b.accountId);
	if (idCmp !== 0) return idCmp;
	return a.hex.localeCompare(b.hex);
}

async function computeParticipantDigest(accountId: string, keyBytes: Uint8Array): Promise<Uint8Array> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error('WebCrypto subtle is not available in the current environment');
	}
	const encoder = new TextEncoder();
	const prefix = encoder.encode(`OSACA:SAFETY_NUMBER:V1:${accountId}:`);
	let data = new Uint8Array(prefix.length + keyBytes.length);
	data.set(prefix, 0);
	data.set(keyBytes, prefix.length);

	for (let i = 0; i < 64; i++) {
		const hashBuf = await subtle.digest('SHA-512', data as any);
		data = new Uint8Array(hashBuf);
	}
	return data;
}

function extract30Digits(digest: Uint8Array): string {
	const chunks: Array<string> = [];
	for (let i = 0; i < 6; i++) {
		const offset = i * 5;
		let num = 0;
		for (let j = 0; j < 5; j++) {
			num = num * 256 + digest[offset + j];
		}
		chunks.push((num % 100000).toString().padStart(5, '0'));
	}
	return chunks.join('');
}

/**
 * Formats a 60-digit string into 12 groups of 5 digits separated by spaces.
 */
export function formatSafetyNumberDigits(digits: string): string {
	const clean = digits.replace(/\D/g, '');
	const groups: Array<string> = [];
	for (let i = 0; i < clean.length; i += 5) {
		groups.push(clean.substring(i, i + 5));
	}
	return groups.join(' ');
}

/**
 * Strips formatting spaces and non-digits from a safety number string.
 */
export function parseSafetyNumberDigits(formatted: string): string {
	return formatted.replace(/\D/g, '');
}

/**
 * Derives a deterministic 60-digit human-comparable Safety Number and QR payload
 * from two Accounts' Identity Keys, independent of comparison order.
 */
export async function deriveSafetyNumber(
	participantA: SafetyNumberParticipant,
	participantB: SafetyNumberParticipant,
): Promise<SafetyNumber> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error('WebCrypto subtle is not available in the current environment');
	}

	const normA = {accountId: participantA.accountId, ...normalizeKey(participantA.publicKey)};
	const normB = {accountId: participantB.accountId, ...normalizeKey(participantB.publicKey)};

	const [first, second] = compareParticipants(normA, normB) <= 0 ? [normA, normB] : [normB, normA];

	const [digestFirst, digestSecond] = await Promise.all([
		computeParticipantDigest(first.accountId, first.bytes),
		computeParticipantDigest(second.accountId, second.bytes),
	]);

	const digitsFirst = extract30Digits(digestFirst);
	const digitsSecond = extract30Digits(digestSecond);
	const rawDigits = `${digitsFirst}${digitsSecond}`;
	const formattedText = formatSafetyNumberDigits(rawDigits);

	// Fingerprint over combined canonical public keys
	const combinedKeys = new Uint8Array(first.bytes.length + second.bytes.length);
	combinedKeys.set(first.bytes, 0);
	combinedKeys.set(second.bytes, first.bytes.length);
	const fpBuf = await subtle.digest('SHA-256', combinedKeys as any);
	const fingerprintHex = uint8ArrayToHex(new Uint8Array(fpBuf));

	const qrObj: SafetyNumberQrPayload = {
		scheme: 'osaca-safety-number',
		version: 1,
		fingerprint: fingerprintHex,
		numeric: rawDigits,
		accounts: [first.accountId, second.accountId],
	};

	return {
		formattedText,
		numeric: rawDigits,
		qrPayload: JSON.stringify(qrObj),
		fingerprintHex,
		participants: [
			{accountId: first.accountId, publicKeyHex: first.hex},
			{accountId: second.accountId, publicKeyHex: second.hex},
		],
	};
}

/**
 * Verifies that a scanned QR payload matches the expected SafetyNumber.
 */
export function verifySafetyNumberQr(qrPayload: string, expected: SafetyNumber): boolean {
	try {
		const parsed = JSON.parse(qrPayload) as Partial<SafetyNumberQrPayload>;
		if (parsed.scheme !== 'osaca-safety-number' || parsed.version !== 1) {
			return false;
		}
		if (parsed.fingerprint !== expected.fingerprintHex) {
			return false;
		}
		if (parsed.numeric !== expected.numeric) {
			return false;
		}
		if (!Array.isArray(parsed.accounts) || parsed.accounts.length !== 2) {
			return false;
		}
		if (
			parsed.accounts[0] !== expected.participants[0].accountId ||
			parsed.accounts[1] !== expected.participants[1].accountId
		) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}
