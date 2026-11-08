// SPDX-License-Identifier: AGPL-3.0-or-later

import {beforeAll, describe, expect, it} from 'vitest';
import {ensureCryptoWasmReady, IdentityKey, initCryptoWasm, MemoryTofuStorage, TofuIdentityStore} from '../index.js';

describe('TOFU Identity Tracking and Safety Numbers', () => {
	beforeAll(async () => {
		await initCryptoWasm();
		ensureCryptoWasmReady();
	});

	it('persists initial contact identity key on first use (TOFU)', () => {
		const storage = new MemoryTofuStorage();
		const store = new TofuIdentityStore('alice_user', storage);

		const bobKey = IdentityKey.generate('bob_user');
		const result = store.recordContactIdentity('bob_user', bobKey.publicKeyHex);

		expect(result.status).toBe('first_seen');
		expect(result.record.accountId).toBe('bob_user');
		expect(result.record.identityKeyHex).toBe(bobKey.publicKeyHex);
		expect(result.record.verified).toBe(false);
		expect(result.record.keyChanged).toBe(false);

		// Verified from fresh store instance using same storage
		const reloadedStore = new TofuIdentityStore('alice_user', storage);
		const bobRecord = reloadedStore.getContact('bob_user');
		expect(bobRecord?.identityKeyHex).toBe(bobKey.publicKeyHex);
	});

	it('marks identical key encounters as trusted', () => {
		const store = new TofuIdentityStore('alice_user');
		const bobKey = IdentityKey.generate('bob_user');

		store.recordContactIdentity('bob_user', bobKey.publicKeyHex);
		const secondSeen = store.recordContactIdentity('bob_user', bobKey.publicKeyHex);

		expect(secondSeen.status).toBe('trusted');
		expect(store.hasKeyChanged('bob_user')).toBe(false);
	});

	it('detects key change, flags keyChanged, and preserves trusted key until acknowledgement', () => {
		const store = new TofuIdentityStore('alice_user');
		const bobOriginal = IdentityKey.generate('bob_user');
		const bobAttacker = IdentityKey.generate('bob_user');

		store.recordContactIdentity('bob_user', bobOriginal.publicKeyHex);
		store.setContactVerified('bob_user', true);
		expect(store.isVerified('bob_user')).toBe(true);

		// Bob presents a different key
		const changeResult = store.recordContactIdentity('bob_user', bobAttacker.publicKeyHex);

		expect(changeResult.status).toBe('key_changed');
		expect(store.hasKeyChanged('bob_user')).toBe(true);
		expect(store.hasUnacknowledgedKeyChange(['bob_user'])).toBe(true);
		expect(changeResult.record.keyChanged).toBe(true);
		expect(changeResult.record.pendingKeyHex).toBe(bobAttacker.publicKeyHex);
		// Trusted key is not overwritten yet
		expect(changeResult.record.identityKeyHex).toBe(bobOriginal.publicKeyHex);
	});

	it('acknowledges key change explicitly, archiving old key and resetting verified status', () => {
		const store = new TofuIdentityStore('alice_user');
		const bobOriginal = IdentityKey.generate('bob_user');
		const bobReplacement = IdentityKey.generate('bob_user');

		store.recordContactIdentity('bob_user', bobOriginal.publicKeyHex);
		store.setContactVerified('bob_user', true);
		store.recordContactIdentity('bob_user', bobReplacement.publicKeyHex);

		const acknowledged = store.acknowledgeKeyChange('bob_user');
		expect(acknowledged).not.toBeNull();
		expect(acknowledged?.keyChanged).toBe(false);
		expect(acknowledged?.identityKeyHex).toBe(bobReplacement.publicKeyHex);
		expect(acknowledged?.pendingKeyHex).toBeUndefined();
		expect(acknowledged?.verified).toBe(false);
		expect(acknowledged?.previousKeys).toHaveLength(1);
		expect(acknowledged?.previousKeys?.[0].identityKeyHex).toBe(bobOriginal.publicKeyHex);

		expect(store.hasKeyChanged('bob_user')).toBe(false);
		expect(store.hasUnacknowledgedKeyChange(['bob_user'])).toBe(false);
	});

	it('supports toggling verified state', () => {
		const store = new TofuIdentityStore('alice_user');
		const bob = IdentityKey.generate('bob_user');

		store.recordContactIdentity('bob_user', bob.publicKeyHex);
		expect(store.isVerified('bob_user')).toBe(false);

		store.setContactVerified('bob_user', true);
		expect(store.isVerified('bob_user')).toBe(true);

		store.setContactVerified('bob_user', false);
		expect(store.isVerified('bob_user')).toBe(false);
	});

	it('derives safety number for contact correctly', async () => {
		const aliceStore = new TofuIdentityStore('alice_user');
		const aliceKey = IdentityKey.generate('alice_user');
		const bobKey = IdentityKey.generate('bob_user');

		aliceStore.recordContactIdentity('bob_user', bobKey.publicKeyHex);

		const safetyNumber = await aliceStore.deriveSafetyNumber('bob_user', aliceKey.publicKeyBytes);
		expect(safetyNumber).not.toBeNull();
		expect(safetyNumber?.numeric).toHaveLength(60);
		expect(safetyNumber?.formattedText).toMatch(/^(\d{5} ){11}\d{5}$/);
	});

	it('processes MLS group members and excludes self', () => {
		const store = new TofuIdentityStore('alice_user');
		const charlieKey = IdentityKey.generate('charlie_user');

		const members = [
			{identity: 'alice_user:desktop', signatureKey: new Uint8Array(32)},
			{identity: 'charlie_user:mobile', signatureKey: charlieKey.publicKeyBytes},
		];

		const results = store.checkGroupMembers(members);
		expect(results).toHaveLength(1);
		expect(results[0].record.accountId).toBe('charlie_user');
		expect(store.getContact('alice_user')).toBeNull();
		expect(store.getContact('charlie_user')?.identityKeyHex).toBe(charlieKey.publicKeyHex);
	});
});
