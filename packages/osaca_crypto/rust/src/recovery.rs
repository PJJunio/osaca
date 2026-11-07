// SPDX-License-Identifier: AGPL-3.0-or-later

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hkdf::Hkdf;
use rand::{rngs::OsRng, RngCore};
use sha2::Sha256;
use thiserror::Error;

use crate::identity::AccountKeyBundle;

const RECOVERY_MAGIC: &[u8; 4] = b"OSRK";
const RECOVERY_VERSION: u8 = 1;
const SALT_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = 4 + 1 + SALT_LEN + NONCE_LEN; // 49 bytes
const HKDF_INFO: &[u8] = b"osaca-recovery-kit-v1";

#[derive(Debug, Error)]
pub enum RecoveryError {
    #[error("invalid recovery payload: payload too short")]
    PayloadTooShort,
    #[error("invalid recovery magic header")]
    InvalidMagic,
    #[error("unsupported recovery format version: {0}")]
    UnsupportedVersion(u8),
    #[error("decryption failed: incorrect recovery secret or corrupted payload")]
    DecryptionFailed,
    #[error("failed to deserialize account key bundle: {0}")]
    DeserializationFailed(#[from] serde_json::Error),
    #[error("key derivation failed")]
    KeyDerivationFailed,
}

/// Generates a fresh 32-byte high-entropy Recovery Kit secret.
pub fn generate_recovery_secret() -> [u8; 32] {
    let mut secret = [0u8; 32];
    OsRng.fill_bytes(&mut secret);
    secret
}

/// Encrypts an Account key bundle with the Recovery Kit secret using HKDF-SHA256 and AES-256-GCM.
pub fn encrypt_recovery_bundle(
    recovery_secret: &[u8],
    bundle: &AccountKeyBundle,
) -> Result<Vec<u8>, RecoveryError> {
    let plaintext = serde_json::to_vec(bundle)?;

    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    let hkdf = Hkdf::<Sha256>::new(Some(&salt), recovery_secret);
    let mut aes_key = [0u8; 32];
    hkdf.expand(HKDF_INFO, &mut aes_key)
        .map_err(|_| RecoveryError::KeyDerivationFailed)?;

    let cipher = Aes256Gcm::new_from_slice(&aes_key)
        .map_err(|_| RecoveryError::KeyDerivationFailed)?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|_| RecoveryError::DecryptionFailed)?;

    let mut out = Vec::with_capacity(HEADER_LEN + ciphertext.len());
    out.extend_from_slice(RECOVERY_MAGIC);
    out.push(RECOVERY_VERSION);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);

    Ok(out)
}

/// Decrypts an encrypted Recovery Kit payload back into an AccountKeyBundle.
pub fn decrypt_recovery_bundle(
    recovery_secret: &[u8],
    payload: &[u8],
) -> Result<AccountKeyBundle, RecoveryError> {
    if payload.len() < HEADER_LEN + 16 {
        return Err(RecoveryError::PayloadTooShort);
    }

    if &payload[0..4] != RECOVERY_MAGIC {
        return Err(RecoveryError::InvalidMagic);
    }

    let version = payload[4];
    if version != RECOVERY_VERSION {
        return Err(RecoveryError::UnsupportedVersion(version));
    }

    let salt = &payload[5..5 + SALT_LEN];
    let nonce_bytes = &payload[5 + SALT_LEN..HEADER_LEN];
    let ciphertext = &payload[HEADER_LEN..];

    let hkdf = Hkdf::<Sha256>::new(Some(salt), recovery_secret);
    let mut aes_key = [0u8; 32];
    hkdf.expand(HKDF_INFO, &mut aes_key)
        .map_err(|_| RecoveryError::KeyDerivationFailed)?;

    let cipher = Aes256Gcm::new_from_slice(&aes_key)
        .map_err(|_| RecoveryError::KeyDerivationFailed)?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| RecoveryError::DecryptionFailed)?;

    let bundle: AccountKeyBundle = serde_json::from_slice(&plaintext)?;
    Ok(bundle)
}
