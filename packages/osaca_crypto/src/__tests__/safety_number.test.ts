// SPDX-License-Identifier: AGPL-3.0-or-later

import {beforeAll, describe, expect, it} from 'vitest';
import {
	deriveSafetyNumber,
	ensureCryptoWasmReady,
	formatSafetyNumberDigits,
	IdentityKey,
	initCryptoWasm,
	parseSafetyNumberDigits,
	verifySafetyNumberQr,
} from '../index.js';

describe('Safety Numbers', () => {
	beforeAll(async () => {
		await initCryptoWasm();
		ensureCryptoWasmReady();
	});

	it('derives a 60-digit safety number deterministically', async () => {
		const aliceId = IdentityKey.generate('alice_user');
		const bobId = IdentityKey.generate('bob_user');

		const sn1 = await deriveSafetyNumber(
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyBytes},
			{accountId: bobId.accountId, publicKey: bobId.publicKeyBytes},
		);

		const sn2 = await deriveSafetyNumber(
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyBytes},
			{accountId: bobId.accountId, publicKey: bobId.publicKeyBytes},
		);

		expect(sn1.numeric).toHaveLength(60);
		expect(/^\d{60}$/.test(sn1.numeric)).toBe(true);
		expect(sn1.numeric).toEqual(sn2.numeric);
		expect(sn1.formattedText).toEqual(sn2.formattedText);
		expect(sn1.fingerprintHex).toEqual(sn2.fingerprintHex);
		expect(sn1.qrPayload).toEqual(sn2.qrPayload);

		// 12 groups of 5 digits separated by spaces
		const groups = sn1.formattedText.split(' ');
		expect(groups).toHaveLength(12);
		for (const g of groups) {
			expect(g).toHaveLength(5);
			expect(/^\d{5}$/.test(g)).toBe(true);
		}
	});

	it('guarantees symmetry: derive(Alice, Bob) === derive(Bob, Alice)', async () => {
		const aliceId = IdentityKey.generate('alice_user');
		const bobId = IdentityKey.generate('bob_user');

		const alicePerspective = await deriveSafetyNumber(
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyBytes},
			{accountId: bobId.accountId, publicKey: bobId.publicKeyHex},
		);

		const bobPerspective = await deriveSafetyNumber(
			{accountId: bobId.accountId, publicKey: bobId.publicKeyBytes},
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyHex},
		);

		expect(alicePerspective.numeric).toBe(bobPerspective.numeric);
		expect(alicePerspective.formattedText).toBe(bobPerspective.formattedText);
		expect(alicePerspective.fingerprintHex).toBe(bobPerspective.fingerprintHex);
		expect(alicePerspective.qrPayload).toBe(bobPerspective.qrPayload);
		expect(alicePerspective.participants).toEqual(bobPerspective.participants);
	});

	it('detects key changes (modifying key produces different safety number)', async () => {
		const aliceId = IdentityKey.generate('alice_user');
		const bobIdOriginal = IdentityKey.generate('bob_user');
		const bobIdNew = IdentityKey.generate('bob_user');

		const originalSn = await deriveSafetyNumber(
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyBytes},
			{accountId: bobIdOriginal.accountId, publicKey: bobIdOriginal.publicKeyBytes},
		);

		const changedSn = await deriveSafetyNumber(
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyBytes},
			{accountId: bobIdNew.accountId, publicKey: bobIdNew.publicKeyBytes},
		);

		expect(originalSn.numeric).not.toBe(changedSn.numeric);
		expect(originalSn.fingerprintHex).not.toBe(changedSn.fingerprintHex);
		expect(originalSn.formattedText).not.toBe(changedSn.formattedText);
	});

	it('verifies QR code payloads accurately', async () => {
		const aliceId = IdentityKey.generate('alice_user');
		const bobId = IdentityKey.generate('bob_user');

		const sn = await deriveSafetyNumber(
			{accountId: aliceId.accountId, publicKey: aliceId.publicKeyBytes},
			{accountId: bobId.accountId, publicKey: bobId.publicKeyBytes},
		);

		expect(verifySafetyNumberQr(sn.qrPayload, sn)).toBe(true);

		// Corrupted payload
		expect(verifySafetyNumberQr('invalid json', sn)).toBe(false);

		// Mismatched numeric
		const fakeQr = JSON.parse(sn.qrPayload);
		fakeQr.numeric = '000000000000000000000000000000000000000000000000000000000000';
		expect(verifySafetyNumberQr(JSON.stringify(fakeQr), sn)).toBe(false);

		// Mismatched fingerprint
		const fakeFp = JSON.parse(sn.qrPayload);
		fakeFp.fingerprint = 'deadbeef';
		expect(verifySafetyNumberQr(JSON.stringify(fakeFp), sn)).toBe(false);

		// Mismatched accounts
		const fakeAccounts = JSON.parse(sn.qrPayload);
		fakeAccounts.accounts = ['mallory', 'bob_user'];
		expect(verifySafetyNumberQr(JSON.stringify(fakeAccounts), sn)).toBe(false);
	});

	it('formats and parses digits correctly', () => {
		const digits = '123456789012345678901234567890123456789012345678901234567890';
		const formatted = formatSafetyNumberDigits(digits);
		expect(formatted).toBe('12345 67890 12345 67890 12345 67890 12345 67890 12345 67890 12345 67890');
		expect(parseSafetyNumberDigits(formatted)).toBe(digits);
	});
});
