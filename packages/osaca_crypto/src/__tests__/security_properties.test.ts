// SPDX-License-Identifier: AGPL-3.0-or-later

import {beforeAll, describe, expect, it} from 'vitest';
import {
	base64ToUint8Array,
	DeviceSession,
	decryptAttachmentBytes,
	deriveSafetyNumber,
	encryptAttachmentBytes,
	ensureCryptoWasmReady,
	IdentityKey,
	initCryptoWasm,
	MemoryTofuStorage,
	MlsGroupSession,
	TofuIdentityStore,
} from '../index.js';

describe('Phase F1 Security Property Tests (osaca_crypto)', () => {
	beforeAll(async () => {
		await initCryptoWasm();
		ensureCryptoWasmReady();
	});

	describe('Security Property 3: Ciphertext Integrity and Tampering Rejection', () => {
		it('rejects tampered MLS application message ciphertext bytes', () => {
			const aliceDevice = DeviceSession.create('alice_user', 'alice_dev');
			const bobDevice = DeviceSession.create('bob_user', 'bob_dev');

			const bobPkg = bobDevice.generateKeyPackage();
			const groupId = new TextEncoder().encode('group_tamper_test');
			const aliceGroup = MlsGroupSession.create(aliceDevice, groupId);

			const addResult = aliceGroup.addMember(bobPkg);
			const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, addResult.welcome);

			// Alice produces a valid encrypted application message
			const originalPlaintext = new TextEncoder().encode('Confidential financial transaction details');
			const validCiphertext = aliceGroup.encryptMessage(originalPlaintext);
			expect(validCiphertext.byteLength).toBeGreaterThan(0);

			// Bob can decrypt the untampered message
			const processed = bobGroup.processMessage(validCiphertext);
			expect(processed.type).toBe('application');
			if (processed.type === 'application') {
				expect(new TextDecoder().decode(processed.plaintext)).toBe('Confidential financial transaction details');
			}

			// Tamper 1: Flip bit in last byte
			const tamperedEnd = new Uint8Array(validCiphertext);
			tamperedEnd[tamperedEnd.byteLength - 1] ^= 0x01;
			expect(() => bobGroup.processMessage(tamperedEnd)).toThrow();

			// Tamper 2: Flip bit in middle
			const tamperedMid = new Uint8Array(validCiphertext);
			const mid = Math.floor(tamperedMid.byteLength / 2);
			tamperedMid[mid] ^= 0x42;
			expect(() => bobGroup.processMessage(tamperedMid)).toThrow();

			// Tamper 3: Truncate ciphertext bytes
			const truncated = validCiphertext.slice(0, validCiphertext.byteLength - 8);
			expect(() => bobGroup.processMessage(truncated)).toThrow();

			// Tamper 4: Prepend random bytes
			const corruptedHeader = new Uint8Array([0xde, 0xad, 0xbe, 0xef, ...validCiphertext]);
			expect(() => bobGroup.processMessage(corruptedHeader)).toThrow();
		});

		it('rejects tampered encrypted attachment bytes and detects digest mismatch', async () => {
			const filePlaintext = new TextEncoder().encode('Sensitive biometric dataset payload');
			const encryptionResult = await encryptAttachmentBytes(filePlaintext);

			expect(encryptionResult.ciphertext.byteLength).toBeGreaterThan(0);
			expect(base64ToUint8Array(encryptionResult.key).byteLength).toBe(32);
			expect(base64ToUint8Array(encryptionResult.nonce).byteLength).toBe(12);
			expect(encryptionResult.sha256.length).toBe(64);

			// Untampered decryption succeeds
			const decrypted = await decryptAttachmentBytes(
				encryptionResult.ciphertext,
				encryptionResult.key,
				encryptionResult.nonce,
				encryptionResult.sha256,
			);
			expect(new TextDecoder().decode(decrypted)).toBe('Sensitive biometric dataset payload');

			// Tamper: Modify 1 byte in attachment ciphertext
			const tamperedCiphertext = new Uint8Array(encryptionResult.ciphertext);
			tamperedCiphertext[10] ^= 0xff;

			// Decrypting tampered ciphertext fails authentication / digest verification
			await expect(
				decryptAttachmentBytes(
					tamperedCiphertext,
					encryptionResult.key,
					encryptionResult.nonce,
					encryptionResult.sha256,
				),
			).rejects.toThrow();

			// Wrong key fails
			const wrongKey = new Uint8Array(32);
			wrongKey.fill(0xaa);
			await expect(
				decryptAttachmentBytes(encryptionResult.ciphertext, wrongKey, encryptionResult.nonce, encryptionResult.sha256),
			).rejects.toThrow();
		});
	});

	describe('Security Property 3: Non-Member Exclusion and Forward Secrecy', () => {
		it('excludes non-member devices from decrypting MLS group ciphertext', () => {
			const aliceDevice = DeviceSession.create('alice_user', 'alice_dev');
			const bobDevice = DeviceSession.create('bob_user', 'bob_dev');
			const malloryDevice = DeviceSession.create('mallory_adversary', 'mallory_dev');

			const bobPkg = bobDevice.generateKeyPackage();
			const groupId = new TextEncoder().encode('group_exclusion_test');
			const aliceGroup = MlsGroupSession.create(aliceDevice, groupId);
			aliceGroup.addMember(bobPkg);

			// Mallory creates her own unrelated group
			const malloryGroupId = new TextEncoder().encode('group_mallory');
			const malloryGroup = MlsGroupSession.create(malloryDevice, malloryGroupId);

			const secretPlaintext = new TextEncoder().encode('Top secret internal strategy memo');
			const ciphertext = aliceGroup.encryptMessage(secretPlaintext);

			// Mallory attempts to decrypt Alice's ciphertext in an unrelated group -> rejected
			expect(() => malloryGroup.processMessage(ciphertext)).toThrow();
		});

		it('enforces past-epoch non-member exclusion for newly joined devices (Forward Secrecy)', () => {
			const aliceDevice = DeviceSession.create('alice_user', 'alice_dev');
			const _bobDevice = DeviceSession.create('bob_user', 'bob_dev');
			const charlieDevice = DeviceSession.create('charlie_user', 'charlie_dev');

			// 1. Alice creates group at Epoch 0
			const groupId = new TextEncoder().encode('group_fs_test');
			const aliceGroup = MlsGroupSession.create(aliceDevice, groupId);
			expect(aliceGroup.getEpoch()).toBe(0n);

			// 2. Alice produces a message at Epoch 0
			const epoch0Plaintext = new TextEncoder().encode('Historic message before Charlie was invited');
			const epoch0Ciphertext = aliceGroup.encryptMessage(epoch0Plaintext);

			// 3. Charlie publishes KeyPackage and Alice adds Charlie, committing to Epoch 1
			const charliePkg = charlieDevice.generateKeyPackage();
			const addResult = aliceGroup.addMember(charliePkg);
			expect(addResult.welcome.byteLength).toBeGreaterThan(0);

			// Charlie joins at Epoch 1
			const charlieGroup = MlsGroupSession.joinFromWelcome(charlieDevice, addResult.welcome);
			expect(charlieGroup.getEpoch()).toBe(1n);

			// 4. Charlie MUST NOT be able to decrypt the historic message from Epoch 0
			expect(() => charlieGroup.processMessage(epoch0Ciphertext)).toThrow();
		});
	});

	describe('Security Property 4: TOFU Key Substitution Detection and Verification Invalidation', () => {
		it('detects key substitution, marks record as key_changed, and invalidates verification status', async () => {
			const storage = new MemoryTofuStorage();
			const aliceStore = new TofuIdentityStore('alice_user', storage);

			const bobKey1 = IdentityKey.generate('bob_user');
			const bobKey2 = IdentityKey.generate('bob_user'); // Attacker substituted key

			expect(bobKey1.publicKeyHex).not.toBe(bobKey2.publicKeyHex);

			// 1. Initial encounter (TOFU first seen)
			const firstSeen = aliceStore.recordContactIdentity('bob_user', bobKey1.publicKeyBytes);
			expect(firstSeen.status).toBe('first_seen');
			expect(firstSeen.record.verified).toBe(false);
			expect(firstSeen.record.keyChanged).toBe(false);

			// 2. Alice verifies Bob out-of-band (e.g. verified Safety Numbers)
			aliceStore.setContactVerified('bob_user', true);
			const verifiedRecord = aliceStore.getContact('bob_user');
			expect(verifiedRecord?.verified).toBe(true);
			expect(aliceStore.isVerified('bob_user')).toBe(true);

			// 3. Subsequent encounter with same legitimate key maintains trusted & verified state
			const trusted = aliceStore.recordContactIdentity('bob_user', bobKey1.publicKeyBytes);
			expect(trusted.status).toBe('trusted');
			expect(trusted.record.verified).toBe(true);
			expect(trusted.record.keyChanged).toBe(false);
			expect(aliceStore.hasKeyChanged('bob_user')).toBe(false);

			// 4. Attacker substitutes Bob's identity key with bobKey2!
			const keySubstitution = aliceStore.recordContactIdentity('bob_user', bobKey2.publicKeyBytes);

			// Critical Security Assertion: Key Change MUST be detected!
			expect(keySubstitution.status).toBe('key_changed');
			expect(keySubstitution.record.keyChanged).toBe(true);
			expect(keySubstitution.record.pendingKeyHex).toBe(bobKey2.publicKeyHex);
			expect(aliceStore.hasKeyChanged('bob_user')).toBe(true);

			// Critical Security Assertion: Prior verification MUST be invalidated!
			expect(keySubstitution.record.verified).toBe(false);
			expect(aliceStore.isVerified('bob_user')).toBe(false);

			// 5. Safety numbers derived with substituted key MUST differ from verified key
			const aliceKey = IdentityKey.generate('alice_user');
			const snLegit = await deriveSafetyNumber(
				{accountId: 'alice_user', publicKey: aliceKey.publicKeyBytes},
				{accountId: 'bob_user', publicKey: bobKey1.publicKeyBytes},
			);
			const snTampered = await deriveSafetyNumber(
				{accountId: 'alice_user', publicKey: aliceKey.publicKeyBytes},
				{accountId: 'bob_user', publicKey: bobKey2.publicKeyBytes},
			);

			expect(snLegit.numeric).not.toBe(snTampered.numeric);
			expect(snLegit.fingerprintHex).not.toBe(snTampered.fingerprintHex);

			// 6. Explicit acknowledgement accepts new key but remains unverified until fresh out-of-band verification
			const ackRecord = aliceStore.acknowledgeKeyChange('bob_user');
			expect(ackRecord).not.toBeNull();
			expect(ackRecord?.keyChanged).toBe(false);
			expect(ackRecord?.identityKeyHex).toBe(bobKey2.publicKeyHex);
			expect(ackRecord?.verified).toBe(false); // Still unverified after key change!
			expect(aliceStore.isVerified('bob_user')).toBe(false);
			expect(ackRecord?.previousKeys?.length).toBe(1);
			expect(ackRecord?.previousKeys?.[0].identityKeyHex).toBe(bobKey1.publicKeyHex);
		});
	});
});
