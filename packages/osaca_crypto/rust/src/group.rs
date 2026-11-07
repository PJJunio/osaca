// SPDX-License-Identifier: AGPL-3.0-or-later

use openmls::prelude::*;
use openmls_basic_credential::SignatureKeyPair;
use openmls_rust_crypto::OpenMlsRustCrypto;
use thiserror::Error;
use tls_codec::{Deserialize as _, Serialize as _};

pub const OSACA_CIPHERSUITE: Ciphersuite =
    Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("OpenMLS key generation error: {0:?}")]
    KeyGenError(String),
    #[error("OpenMLS key package error: {0:?}")]
    KeyPackageError(String),
    #[error("OpenMLS new group error: {0:?}")]
    NewGroupError(String),
    #[error("OpenMLS welcome join error: {0:?}")]
    WelcomeError(String),
    #[error("OpenMLS add member error: {0:?}")]
    AddMemberError(String),
    #[error("OpenMLS remove member error: {0:?}")]
    RemoveMemberError(String),
    #[error("OpenMLS create message error: {0:?}")]
    CreateMessageError(String),
    #[error("OpenMLS process message error: {0:?}")]
    ProcessMessageError(String),
    #[error("TLS codec serialization/deserialization error: {0:?}")]
    TlsCodecError(String),
    #[error("protocol message conversion error: {0:?}")]
    ProtocolMessageError(String),
    #[error("expected application message but got another message type")]
    NotAnApplicationMessage,
}

/// A device session representing an authenticated device in MLS.
pub struct DeviceSession {
    pub account_id: String,
    pub device_id: String,
    pub signer: SignatureKeyPair,
    pub credential_with_key: CredentialWithKey,
    pub provider: OpenMlsRustCrypto,
}

impl DeviceSession {
    /// Creates a new DeviceSession for an account and device identifier.
    pub fn new(account_id: impl Into<String>, device_id: impl Into<String>) -> Result<Self, CryptoError> {
        let account_id = account_id.into();
        let device_id = device_id.into();
        let identity_bytes = format!("{account_id}:{device_id}").into_bytes();

        let signer = SignatureKeyPair::new(OSACA_CIPHERSUITE.signature_algorithm())
            .map_err(|e| CryptoError::KeyGenError(format!("{e:?}")))?;

        let provider = OpenMlsRustCrypto::default();
        signer
            .store(provider.storage())
            .map_err(|e| CryptoError::KeyGenError(format!("{e:?}")))?;

        let credential = BasicCredential::new(identity_bytes);
        let credential_with_key = CredentialWithKey {
            credential: credential.into(),
            signature_key: signer.public().into(),
        };

        Ok(Self {
            account_id,
            device_id,
            signer,
            credential_with_key,
            provider,
        })
    }

    /// Generates a signed MLS KeyPackage for this device.
    pub fn generate_key_package(&self) -> Result<Vec<u8>, CryptoError> {
        let key_package_bundle = KeyPackage::builder()
            .build(
                OSACA_CIPHERSUITE,
                &self.provider,
                &self.signer,
                self.credential_with_key.clone(),
            )
            .map_err(|e| CryptoError::KeyPackageError(format!("{e:?}")))?;

        key_package_bundle
            .key_package()
            .tls_serialize_detached()
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))
    }
}

/// Result of adding a member to an MLS group.
pub struct AddMemberResult {
    /// The Commit message fan-out to existing members of the group.
    pub commit: Vec<u8>,
    /// The Welcome message sent to the newly added member.
    pub welcome: Vec<u8>,
    /// New epoch of the group after merging the commit.
    pub epoch: u64,
}

/// Information about a member in an MLS group.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GroupMemberInfo {
    pub index: u32,
    pub identity: String,
    pub signature_key: Vec<u8>,
    pub encryption_key: Vec<u8>,
}

/// Result of processing an incoming MLS message.
pub enum ProcessedMessageOutput {
    ApplicationMessage {
        epoch: u64,
        plaintext: Vec<u8>,
    },
    Commit {
        new_epoch: u64,
    },
    Other,
}

/// An MLS group session wrapping an OpenMLS group.
pub struct MlsGroupSession {
    pub group: MlsGroup,
    pub provider: OpenMlsRustCrypto,
    pub signer: SignatureKeyPair,
}

impl MlsGroupSession {
    /// Creates a new MLS group where the provided device is the initial member and creator.
    pub fn create(device: &DeviceSession, group_id: &[u8]) -> Result<Self, CryptoError> {
        let group_config = MlsGroupCreateConfig::builder()
            .ciphersuite(OSACA_CIPHERSUITE)
            .use_ratchet_tree_extension(true)
            .build();

        let group = MlsGroup::new_with_group_id(
            &device.provider,
            &device.signer,
            &group_config,
            GroupId::from_slice(group_id),
            device.credential_with_key.clone(),
        )
        .map_err(|e| CryptoError::NewGroupError(format!("{e:?}")))?;

        Ok(Self {
            group,
            provider: device.provider.clone(),
            signer: device.signer.clone(),
        })
    }

    /// Joins an MLS group from a Welcome message using the device's key material.
    pub fn join_from_welcome(
        device: &DeviceSession,
        welcome_bytes: &[u8],
    ) -> Result<Self, CryptoError> {
        let msg_in = MlsMessageIn::tls_deserialize(&mut &welcome_bytes[..])
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))?;

        let welcome = match msg_in.extract() {
            MlsMessageBodyIn::Welcome(w) => w,
            _ => {
                return Err(CryptoError::WelcomeError(
                    "expected welcome message body in MLS message".into(),
                ))
            }
        };

        let group_config = MlsGroupJoinConfig::builder()
            .use_ratchet_tree_extension(true)
            .build();

        let group = StagedWelcome::new_from_welcome(&device.provider, &group_config, welcome, None)
            .map_err(|e| CryptoError::WelcomeError(format!("{e:?}")))?
            .into_group(&device.provider)
            .map_err(|e| CryptoError::WelcomeError(format!("{e:?}")))?;

        Ok(Self {
            group,
            provider: device.provider.clone(),
            signer: device.signer.clone(),
        })
    }

    /// Adds a new member to the group using their signed KeyPackage bytes.
    pub fn add_member(&mut self, key_package_bytes: &[u8]) -> Result<AddMemberResult, CryptoError> {
        let key_package_in = KeyPackageIn::tls_deserialize(&mut &key_package_bytes[..])
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))?;

        let key_package = key_package_in
            .validate(self.provider.crypto(), ProtocolVersion::Mls10)
            .map_err(|e| CryptoError::KeyPackageError(format!("{e:?}")))?;

        let (commit_out, welcome_out, _) = self
            .group
            .add_members(&self.provider, &self.signer, &[key_package])
            .map_err(|e| CryptoError::AddMemberError(format!("{e:?}")))?;

        // Immediately merge the pending commit so committer's group state advances epoch
        self.group
            .merge_pending_commit(&self.provider)
            .map_err(|e| CryptoError::AddMemberError(format!("{e:?}")))?;

        let commit_bytes = commit_out
            .tls_serialize_detached()
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))?;

        let welcome_bytes = welcome_out
            .tls_serialize_detached()
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))?;

        Ok(AddMemberResult {
            commit: commit_bytes,
            welcome: welcome_bytes,
            epoch: self.group.epoch().as_u64(),
        })
    }

    /// Removes a member by their ratchet tree leaf index and advances the epoch.
    pub fn remove_member(&mut self, leaf_index: u32) -> Result<Vec<u8>, CryptoError> {
        let (commit_out, _, _) = self
            .group
            .remove_members(
                &self.provider,
                &self.signer,
                &[openmls::prelude::LeafNodeIndex::new(leaf_index)],
            )
            .map_err(|e| CryptoError::RemoveMemberError(format!("{e:?}")))?;

        self.group
            .merge_pending_commit(&self.provider)
            .map_err(|e| CryptoError::RemoveMemberError(format!("{e:?}")))?;

        commit_out
            .tls_serialize_detached()
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))
    }

    /// Encrypts an application message for the current epoch of the group.
    pub fn encrypt_message(&mut self, plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let msg_out = self
            .group
            .create_message(&self.provider, &self.signer, plaintext)
            .map_err(|e| CryptoError::CreateMessageError(format!("{e:?}")))?;

        msg_out
            .tls_serialize_detached()
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))
    }

    /// Processes an incoming MLS message (Commit, Application Message, etc.).
    pub fn process_message(
        &mut self,
        message_bytes: &[u8],
    ) -> Result<ProcessedMessageOutput, CryptoError> {
        let msg_in = MlsMessageIn::tls_deserialize(&mut &message_bytes[..])
            .map_err(|e| CryptoError::TlsCodecError(format!("{e:?}")))?;

        let protocol_msg = msg_in
            .try_into_protocol_message()
            .map_err(|e| CryptoError::ProtocolMessageError(format!("{e:?}")))?;

        let processed = self
            .group
            .process_message(&self.provider, protocol_msg)
            .map_err(|e| CryptoError::ProcessMessageError(format!("{e:?}")))?;

        match processed.into_content() {
            ProcessedMessageContent::ApplicationMessage(app_msg) => {
                Ok(ProcessedMessageOutput::ApplicationMessage {
                    epoch: self.group.epoch().as_u64(),
                    plaintext: app_msg.into_bytes(),
                })
            }
            ProcessedMessageContent::StagedCommitMessage(staged_commit) => {
                self.group
                    .merge_staged_commit(&self.provider, *staged_commit)
                    .map_err(|e| CryptoError::ProcessMessageError(format!("{e:?}")))?;
                Ok(ProcessedMessageOutput::Commit {
                    new_epoch: self.group.epoch().as_u64(),
                })
            }
            _ => Ok(ProcessedMessageOutput::Other),
        }
    }

    /// Decrypts an incoming MLS application ciphertext and returns the plaintext payload.
    pub fn decrypt_message(&mut self, ciphertext: &[u8]) -> Result<Vec<u8>, CryptoError> {
        match self.process_message(ciphertext)? {
            ProcessedMessageOutput::ApplicationMessage { plaintext, .. } => Ok(plaintext),
            _ => Err(CryptoError::NotAnApplicationMessage),
        }
    }

    /// Returns the current epoch counter of the group.
    pub fn epoch(&self) -> u64 {
        self.group.epoch().as_u64()
    }

    /// Returns the group identifier.
    pub fn group_id(&self) -> &[u8] {
        self.group.group_id().as_slice()
    }

    /// Returns the list of members currently in the group.
    pub fn members(&self) -> Vec<GroupMemberInfo> {
        self.group
            .members()
            .map(|m| {
                let identity = match BasicCredential::try_from(m.credential) {
                    Ok(basic) => String::from_utf8_lossy(basic.identity()).into_owned(),
                    Err(_) => "unknown".to_string(),
                };
                GroupMemberInfo {
                    index: m.index.u32(),
                    identity,
                    signature_key: m.signature_key,
                    encryption_key: m.encryption_key,
                }
            })
            .collect()
    }
}
