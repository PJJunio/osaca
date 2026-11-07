// SPDX-License-Identifier: AGPL-3.0-or-later

#[cfg(test)]
mod tests {
    use crate::group::{DeviceSession, MlsGroupSession, ProcessedMessageOutput};
    use crate::identity::{AccountKeyBundle, IdentityKey};
    use crate::recovery::{
        decrypt_recovery_bundle, encrypt_recovery_bundle, generate_recovery_secret, RecoveryError,
    };

    #[test]
    fn test_identity_key_generation_and_restore() {
        let account_id = "user_123456789";
        let identity = IdentityKey::generate(account_id);
        assert_eq!(identity.account_id(), account_id);

        let seed = *identity.seed();
        let pubkey_bytes = identity.public_key_bytes();
        let pubkey_hex = identity.public_key_hex();
        assert_eq!(pubkey_hex.len(), 64);

        let restored = IdentityKey::from_seed(account_id, seed);
        assert_eq!(restored.account_id(), account_id);
        assert_eq!(restored.public_key_bytes(), pubkey_bytes);
        assert_eq!(restored.public_key_hex(), pubkey_hex);
    }

    #[test]
    fn test_recovery_kit_bundle_roundtrip() {
        let identity = IdentityKey::generate("user_secure_999");
        let bundle = AccountKeyBundle::new(&identity, 1700000000000);
        let secret = generate_recovery_secret();

        // Encrypt bundle
        let encrypted = encrypt_recovery_bundle(&secret, &bundle).expect("encryption succeeds");
        assert!(!encrypted.is_empty());

        // Decrypt with correct secret
        let restored_bundle = decrypt_recovery_bundle(&secret, &encrypted).expect("decryption succeeds");
        assert_eq!(restored_bundle.account_id, "user_secure_999");
        assert_eq!(restored_bundle.identity_seed, *identity.seed());
        assert_eq!(restored_bundle.created_at_ms, 1700000000000);

        let restored_identity = restored_bundle.to_identity_key();
        assert_eq!(restored_identity.public_key_bytes(), identity.public_key_bytes());

        // Decrypt with wrong secret fails
        let wrong_secret = generate_recovery_secret();
        let err = decrypt_recovery_bundle(&wrong_secret, &encrypted).expect_err("must fail");
        assert!(matches!(err, RecoveryError::DecryptionFailed));

        // Corrupted payload fails
        let mut corrupted = encrypted.clone();
        let len = corrupted.len();
        corrupted[len - 1] ^= 0xff;
        let err_corrupted = decrypt_recovery_bundle(&secret, &corrupted).expect_err("must fail");
        assert!(matches!(err_corrupted, RecoveryError::DecryptionFailed));
    }

    #[test]
    fn test_two_party_mls_group_lifecycle() {
        // 1. Alice & Bob create their device sessions
        let alice_device = DeviceSession::new("alice_user", "phone").expect("alice device created");
        let bob_device = DeviceSession::new("bob_user", "laptop").expect("bob device created");

        // 2. Bob publishes a KeyPackage
        let bob_key_package = bob_device
            .generate_key_package()
            .expect("bob key package generated");
        assert!(!bob_key_package.is_empty());

        // 3. Alice creates a group for their DM
        let group_id = b"dm_alice_bob_12345";
        let mut alice_group =
            MlsGroupSession::create(&alice_device, group_id).expect("alice group created");
        assert_eq!(alice_group.epoch(), 0);
        assert_eq!(alice_group.members().len(), 1);

        // 4. Alice adds Bob to the group
        let add_res = alice_group
            .add_member(&bob_key_package)
            .expect("bob added to group");
        assert_eq!(alice_group.epoch(), 1);
        assert_eq!(add_res.epoch, 1);
        assert_eq!(alice_group.members().len(), 2);

        // 5. Bob joins the group from the Welcome message
        let mut bob_group = MlsGroupSession::join_from_welcome(&bob_device, &add_res.welcome)
            .expect("bob joined from welcome");
        assert_eq!(bob_group.epoch(), 1);
        assert_eq!(bob_group.members().len(), 2);

        // 6. Alice encrypts an application message
        let alice_msg = b"Hello Bob! This is private.";
        let ciphertext = alice_group
            .encrypt_message(alice_msg)
            .expect("alice message encrypted");
        assert!(!ciphertext.is_empty());

        // 7. Bob decrypts Alice's message
        let decrypted_by_bob = bob_group
            .decrypt_message(&ciphertext)
            .expect("bob decrypted alice message");
        assert_eq!(decrypted_by_bob, alice_msg);

        // 8. Bob replies
        let bob_msg = b"Hey Alice! E2EE with OpenMLS is working!";
        let bob_ciphertext = bob_group
            .encrypt_message(bob_msg)
            .expect("bob message encrypted");

        // 9. Alice decrypts Bob's reply
        let decrypted_by_alice = alice_group
            .decrypt_message(&bob_ciphertext)
            .expect("alice decrypted bob reply");
        assert_eq!(decrypted_by_alice, bob_msg);
    }

    #[test]
    fn test_multi_party_group_epoch_advancement_and_removal() {
        // Alice, Bob, and Charlie
        let alice = DeviceSession::new("alice", "d1").unwrap();
        let bob = DeviceSession::new("bob", "d1").unwrap();
        let charlie = DeviceSession::new("charlie", "d1").unwrap();

        let bob_kp = bob.generate_key_package().unwrap();
        let charlie_kp = charlie.generate_key_package().unwrap();

        // Alice creates group
        let mut alice_group = MlsGroupSession::create(&alice, b"group_abc").unwrap();
        assert_eq!(alice_group.epoch(), 0);

        // Alice adds Bob
        let add_bob = alice_group.add_member(&bob_kp).unwrap();
        assert_eq!(alice_group.epoch(), 1);
        let mut bob_group = MlsGroupSession::join_from_welcome(&bob, &add_bob.welcome).unwrap();
        assert_eq!(bob_group.epoch(), 1);

        // Alice adds Charlie (epoch -> 2)
        let add_charlie = alice_group.add_member(&charlie_kp).unwrap();
        assert_eq!(alice_group.epoch(), 2);

        // Bob processes Alice's commit adding Charlie -> Bob advances to epoch 2
        match bob_group.process_message(&add_charlie.commit).unwrap() {
            ProcessedMessageOutput::Commit { new_epoch } => assert_eq!(new_epoch, 2),
            _ => panic!("expected commit"),
        }
        assert_eq!(bob_group.epoch(), 2);

        // Charlie joins from Welcome -> Charlie is at epoch 2
        let mut charlie_group =
            MlsGroupSession::join_from_welcome(&charlie, &add_charlie.welcome).unwrap();
        assert_eq!(charlie_group.epoch(), 2);
        assert_eq!(charlie_group.members().len(), 3);

        // Charlie encrypts a message in epoch 2
        let msg = b"Welcome Charlie to the group!";
        let c_cipher = charlie_group.encrypt_message(msg).unwrap();

        // Alice and Bob both decrypt it
        assert_eq!(alice_group.decrypt_message(&c_cipher).unwrap(), msg);
        assert_eq!(bob_group.decrypt_message(&c_cipher).unwrap(), msg);

        // Find Bob's leaf index in the group
        let bob_member = alice_group
            .members()
            .into_iter()
            .find(|m| m.identity.starts_with("bob:"))
            .expect("bob found");

        // Alice removes Bob from group (epoch -> 3)
        let remove_commit = alice_group.remove_member(bob_member.index).unwrap();
        assert_eq!(alice_group.epoch(), 3);
        assert_eq!(alice_group.members().len(), 2);

        // Charlie processes the remove commit -> Charlie advances to epoch 3
        match charlie_group.process_message(&remove_commit).unwrap() {
            ProcessedMessageOutput::Commit { new_epoch } => assert_eq!(new_epoch, 3),
            _ => panic!("expected commit"),
        }
        assert_eq!(charlie_group.epoch(), 3);
        assert_eq!(charlie_group.members().len(), 2);

        // Alice sends message in epoch 3
        let post_removal_msg = b"Bob is no longer in this conversation.";
        let cipher_epoch3 = alice_group.encrypt_message(post_removal_msg).unwrap();

        // Charlie can decrypt
        assert_eq!(
            charlie_group.decrypt_message(&cipher_epoch3).unwrap(),
            post_removal_msg
        );

        // Bob cannot decrypt (evicted from group / wrong epoch)
        let bob_attempt = bob_group.decrypt_message(&cipher_epoch3);
        assert!(bob_attempt.is_err(), "evicted member must not be able to decrypt post-eviction messages");
    }
}
