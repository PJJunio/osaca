// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {DeviceSession, ensureCryptoWasmReady, IdentityKey, MlsGroupSession, RecoveryKit} from '../index.js';

describe('osaca_crypto (TypeScript WASM interface)', () => {
	it('initializes WASM successfully', () => {
		const wasm = ensureCryptoWasmReady();
		expect(wasm).toBeDefined();
		expect(wasm.memory.buffer.byteLength).toBeGreaterThan(0);
	});

	describe('IdentityKey', () => {
		it('generates an identity key and restores from seed', () => {
			const alice = IdentityKey.generate('account_alice_123');
			expect(alice.accountId).toBe('account_alice_123');
			expect(alice.seed.byteLength).toBe(32);
			expect(alice.publicKeyBytes.byteLength).toBe(32);
			expect(alice.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

			const restored = IdentityKey.fromSeed('account_alice_123', alice.seed);
			expect(restored.accountId).toBe(alice.accountId);
			expect(restored.publicKeyHex).toBe(alice.publicKeyHex);
			expect(Array.from(restored.publicKeyBytes)).toEqual(Array.from(alice.publicKeyBytes));
		});

		it('creates an AccountKeyBundle', () => {
			const alice = IdentityKey.generate('account_alice_456');
			const now = Date.now();
			const bundle = alice.createAccountKeyBundle(now);

			expect(bundle.accountId).toBe('account_alice_456');
			expect(bundle.version).toBe(1);
			expect(bundle.createdAtMs).toBe(now);
			expect(Array.from(bundle.identitySeed)).toEqual(Array.from(alice.seed));
		});
	});

	describe('RecoveryKit', () => {
		it('encrypts and decrypts account key bundle offline roundtrip', () => {
			const alice = IdentityKey.generate('account_alice_recovery');
			const bundle = alice.createAccountKeyBundle(1700000000000);

			const secret = RecoveryKit.generateSecret();
			expect(secret.byteLength).toBe(32);

			const encrypted = RecoveryKit.encryptBundle(secret, bundle);
			expect(encrypted.byteLength).toBeGreaterThan(64);

			// Decrypt with correct secret
			const decrypted = RecoveryKit.decryptBundle(secret, encrypted);
			expect(decrypted.accountId).toBe(bundle.accountId);
			expect(decrypted.version).toBe(bundle.version);
			expect(decrypted.createdAtMs).toBe(bundle.createdAtMs);
			expect(Array.from(decrypted.identitySeed)).toEqual(Array.from(bundle.identitySeed));

			// Decrypt with wrong secret fails
			const wrongSecret = RecoveryKit.generateSecret();
			expect(() => RecoveryKit.decryptBundle(wrongSecret, encrypted)).toThrow();

			// Decrypt with corrupted ciphertext fails
			const corrupted = new Uint8Array(encrypted);
			corrupted[encrypted.byteLength - 1] ^= 0xff;
			expect(() => RecoveryKit.decryptBundle(secret, corrupted)).toThrow();
		});
	});

	describe('MLS Group Lifecycle', () => {
		it('supports 2-party DM lifecycle with Commit, Welcome, and Application messages', () => {
			// 1. Create devices for Alice and Bob
			const aliceDevice = DeviceSession.create('alice_user', 'alice_desktop');
			const bobDevice = DeviceSession.create('bob_user', 'bob_mobile');

			expect(aliceDevice.accountId).toBe('alice_user');
			expect(aliceDevice.deviceId).toBe('alice_desktop');
			expect(bobDevice.accountId).toBe('bob_user');

			// 2. Bob publishes a KeyPackage
			const bobKeyPackage = bobDevice.generateKeyPackage();
			expect(bobKeyPackage.byteLength).toBeGreaterThan(0);

			// 3. Alice creates a group for their direct message channel
			const groupId = new TextEncoder().encode('dm_alice_bob_channel_999');
			const aliceGroup = MlsGroupSession.create(aliceDevice, groupId);

			expect(aliceGroup.getEpoch()).toBe(0n);
			const initialMembers = aliceGroup.getMembers();
			expect(initialMembers.length).toBe(1);
			expect(initialMembers[0].identity).toContain('alice_user:alice_desktop');

			// 4. Alice adds Bob to the group
			const addResult = aliceGroup.addMember(bobKeyPackage);
			expect(addResult.epoch).toBe(1n);
			expect(aliceGroup.getEpoch()).toBe(1n);
			expect(addResult.commit.byteLength).toBeGreaterThan(0);
			expect(addResult.welcome.byteLength).toBeGreaterThan(0);

			const twoMembers = aliceGroup.getMembers();
			expect(twoMembers.length).toBe(2);

			// 5. Bob joins the group from the Welcome message
			const bobGroup = MlsGroupSession.joinFromWelcome(bobDevice, addResult.welcome);
			expect(bobGroup.getEpoch()).toBe(1n);
			const bobViewMembers = bobGroup.getMembers();
			expect(bobViewMembers.length).toBe(2);

			// 6. Alice encrypts an application message
			const msg1 = new TextEncoder().encode('Hello Bob! E2EE DM via OpenMLS WASM');
			const ciphertext1 = aliceGroup.encryptMessage(msg1);
			expect(ciphertext1.byteLength).toBeGreaterThan(msg1.byteLength);

			// 7. Bob decrypts Alice's message
			const processed1 = bobGroup.processMessage(ciphertext1);
			expect(processed1.type).toBe('application');
			if (processed1.type === 'application') {
				expect(processed1.epoch).toBe(1n);
				const decoded = new TextDecoder().decode(processed1.plaintext);
				expect(decoded).toBe('Hello Bob! E2EE DM via OpenMLS WASM');
			}

			// 8. Bob replies to Alice
			const msg2 = new TextEncoder().encode('Hey Alice! Message received securely.');
			const ciphertext2 = bobGroup.encryptMessage(msg2);

			// 9. Alice decrypts Bob's message
			const processed2 = aliceGroup.processMessage(ciphertext2);
			expect(processed2.type).toBe('application');
			if (processed2.type === 'application') {
				expect(processed2.epoch).toBe(1n);
				const decoded = new TextDecoder().decode(processed2.plaintext);
				expect(decoded).toBe('Hey Alice! Message received securely.');
			}
		});

		it('supports multi-party MLS groups, commit fanout epoch advancement, and member removal', () => {
			// Setup Alice, Bob, Charlie
			const alice = DeviceSession.create('alice', 'dev_a');
			const bob = DeviceSession.create('bob', 'dev_b');
			const charlie = DeviceSession.create('charlie', 'dev_c');

			const bobKp = bob.generateKeyPackage();
			const charlieKp = charlie.generateKeyPackage();

			// Alice creates group and adds Bob
			const groupId = new TextEncoder().encode('trio_group_chat');
			const aliceGroup = MlsGroupSession.create(alice, groupId);
			const addBob = aliceGroup.addMember(bobKp);
			expect(aliceGroup.getEpoch()).toBe(1n);

			const bobGroup = MlsGroupSession.joinFromWelcome(bob, addBob.welcome);
			expect(bobGroup.getEpoch()).toBe(1n);

			// Alice adds Charlie
			const addCharlie = aliceGroup.addMember(charlieKp);
			expect(addCharlie.epoch).toBe(2n);
			expect(aliceGroup.getEpoch()).toBe(2n);
			expect(aliceGroup.getMembers().length).toBe(3);

			// Charlie joins from Welcome
			const charlieGroup = MlsGroupSession.joinFromWelcome(charlie, addCharlie.welcome);
			expect(charlieGroup.getEpoch()).toBe(2n);
			expect(charlieGroup.getMembers().length).toBe(3);

			// Bob processes Alice's Commit to advance his epoch from 1 to 2
			const bobProcCommit = bobGroup.processMessage(addCharlie.commit);
			expect(bobProcCommit.type).toBe('commit');
			if (bobProcCommit.type === 'commit') {
				expect(bobProcCommit.newEpoch).toBe(2n);
			}
			expect(bobGroup.getEpoch()).toBe(2n);
			expect(bobGroup.getMembers().length).toBe(3);

			// Charlie broadcasts an encrypted message to the group
			const charlieMsg = new TextEncoder().encode('Greetings from Charlie to the whole group!');
			const charlieCt = charlieGroup.encryptMessage(charlieMsg);

			// Alice and Bob receive and decrypt Charlie's message
			const aliceProc = aliceGroup.processMessage(charlieCt);
			expect(aliceProc.type).toBe('application');
			if (aliceProc.type === 'application') {
				expect(new TextDecoder().decode(aliceProc.plaintext)).toBe('Greetings from Charlie to the whole group!');
			}

			const bobProc = bobGroup.processMessage(charlieCt);
			expect(bobProc.type).toBe('application');
			if (bobProc.type === 'application') {
				expect(new TextDecoder().decode(bobProc.plaintext)).toBe('Greetings from Charlie to the whole group!');
			}

			// Alice removes Bob (leaf index 1)
			const removeCommit = aliceGroup.removeMember(1);
			expect(aliceGroup.getEpoch()).toBe(3n);
			expect(aliceGroup.getMembers().length).toBe(2);

			// Charlie processes removal commit
			const charlieProcRemoval = charlieGroup.processMessage(removeCommit);
			expect(charlieProcRemoval.type).toBe('commit');
			expect(charlieGroup.getEpoch()).toBe(3n);
			expect(charlieGroup.getMembers().length).toBe(2);

			// Alice sends message in epoch 3 to Charlie
			const postRemovalMsg = new TextEncoder().encode('Alice & Charlie private message now');
			const postRemovalCt = aliceGroup.encryptMessage(postRemovalMsg);

			const charlieDecrypted = charlieGroup.processMessage(postRemovalCt);
			expect(charlieDecrypted.type).toBe('application');
			if (charlieDecrypted.type === 'application') {
				expect(new TextDecoder().decode(charlieDecrypted.plaintext)).toBe('Alice & Charlie private message now');
			}
		});
	});
});
