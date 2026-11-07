// SPDX-License-Identifier: AGPL-3.0-or-later

use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Account Identity Key: long-term Ed25519 key identifying an Account across all its Devices.
#[derive(Clone, Serialize, Deserialize)]
pub struct IdentityKey {
    pub account_id: String,
    pub seed: [u8; 32],
}

impl Drop for IdentityKey {
    fn drop(&mut self) {
        self.seed.zeroize();
    }
}

impl ZeroizeOnDrop for IdentityKey {}

impl IdentityKey {
    /// Generates a fresh 32-byte IdentityKey seed for the given account.
    pub fn generate(account_id: impl Into<String>) -> Self {
        let mut seed = [0u8; 32];
        OsRng.fill_bytes(&mut seed);
        Self {
            account_id: account_id.into(),
            seed,
        }
    }

    /// Restores an IdentityKey from an existing 32-byte seed.
    pub fn from_seed(account_id: impl Into<String>, seed: [u8; 32]) -> Self {
        Self {
            account_id: account_id.into(),
            seed,
        }
    }

    /// Derives the 32-byte Ed25519 public verifying key from the seed.
    pub fn public_key_bytes(&self) -> [u8; 32] {
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&self.seed);
        signing_key.verifying_key().to_bytes()
    }

    /// Derives the hex string representation of the public key.
    pub fn public_key_hex(&self) -> String {
        hex_encode(&self.public_key_bytes())
    }

    pub fn account_id(&self) -> &str {
        &self.account_id
    }

    pub fn seed(&self) -> &[u8; 32] {
        &self.seed
    }
}

/// Offline Account backup bundle contained inside a Recovery Kit.
#[derive(Debug, Clone, Serialize, Deserialize, ZeroizeOnDrop)]
pub struct AccountKeyBundle {
    pub account_id: String,
    #[zeroize(skip)]
    pub version: u32,
    pub identity_seed: [u8; 32],
    #[zeroize(skip)]
    pub created_at_ms: u64,
}

impl AccountKeyBundle {
    pub fn new(identity: &IdentityKey, created_at_ms: u64) -> Self {
        Self {
            account_id: identity.account_id().to_owned(),
            version: 1,
            identity_seed: *identity.seed(),
            created_at_ms,
        }
    }

    pub fn to_identity_key(&self) -> IdentityKey {
        IdentityKey::from_seed(&self.account_id, self.identity_seed)
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(s, "{:02x}", b);
    }
    s
}
