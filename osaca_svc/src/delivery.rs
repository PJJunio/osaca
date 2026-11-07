// SPDX-License-Identifier: AGPL-3.0-or-later

use chrono::{DateTime, Duration, Utc};
use deadpool_postgres::Pool;
use hex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

const POSTGRES_MLS_SCHEMA_LOCK_NAMESPACE: i32 = 0x4d4c_5301;
const POSTGRES_MLS_SCHEMA_LOCK_TIMEOUT: &str = "120s";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyPackageRecord {
    pub key_package_hash: String,
    pub device_id: String,
    pub key_package_bytes: Vec<u8>,
    pub consumed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MlsGroupRecord {
    pub group_id: String,
    pub current_epoch: u64,
    pub disappearing_ttl_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CiphertextRecord {
    pub group_id: String,
    pub epoch: u64,
    pub message_id: String,
    pub ciphertext: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DeliveryError {
    #[error("MLS group not found: {0}")]
    GroupNotFound(String),

    #[error("MLS epoch conflict: current epoch is {current_epoch}, but commit requested epoch {requested_epoch}")]
    EpochConflict {
        current_epoch: u64,
        requested_epoch: u64,
    },

    #[error("no key packages available for device: {0}")]
    KeyPackageExhaustion(String),

    #[error("invalid MLS data: {0}")]
    InvalidData(String),

    #[error("storage error: {0}")]
    Storage(String),
}

impl From<anyhow::Error> for DeliveryError {
    fn from(err: anyhow::Error) -> Self {
        Self::Storage(err.to_string())
    }
}

impl From<tokio_postgres::Error> for DeliveryError {
    fn from(err: tokio_postgres::Error) -> Self {
        Self::Storage(err.to_string())
    }
}

impl From<deadpool_postgres::PoolError> for DeliveryError {
    fn from(err: deadpool_postgres::PoolError) -> Self {
        Self::Storage(err.to_string())
    }
}

#[async_trait::async_trait]
pub trait DeliveryStorage: Send + Sync {
    async fn ensure_schema(&self) -> Result<(), DeliveryError>;
    async fn publish_key_packages(
        &self,
        device_id: &str,
        packages: Vec<Vec<u8>>,
    ) -> Result<usize, DeliveryError>;
    async fn claim_key_package(&self, device_id: &str) -> Result<Vec<u8>, DeliveryError>;
    async fn create_group(
        &self,
        group_id: &str,
        disappearing_ttl_seconds: Option<i32>,
    ) -> Result<MlsGroupRecord, DeliveryError>;
    async fn get_group(&self, group_id: &str) -> Result<Option<MlsGroupRecord>, DeliveryError>;
    async fn post_commit(
        &self,
        group_id: &str,
        epoch: u64,
        commit_bytes: &[u8],
        welcome_bytes: Option<&[u8]>,
    ) -> Result<u64, DeliveryError>;
    async fn get_commit(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError>;
    async fn get_welcome(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError>;
    async fn post_ciphertext(
        &self,
        group_id: &str,
        epoch: u64,
        message_id: &str,
        ciphertext: &[u8],
    ) -> Result<CiphertextRecord, DeliveryError>;
    async fn get_ciphertext_history(
        &self,
        group_id: &str,
        member_join_epoch: u64,
        before_message_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<CiphertextRecord>, DeliveryError>;
}

pub struct DeliveryService<S: DeliveryStorage = PostgresDeliveryStorage> {
    storage: Arc<S>,
}

impl<S: DeliveryStorage> DeliveryService<S> {
    pub fn new(storage: S) -> Self {
        Self {
            storage: Arc::new(storage),
        }
    }

    pub fn from_arc(storage: Arc<S>) -> Self {
        Self { storage }
    }

    pub fn storage(&self) -> &S {
        &self.storage
    }

    pub async fn ensure_schema(&self) -> Result<(), DeliveryError> {
        self.storage.ensure_schema().await
    }

    pub async fn publish_key_packages(
        &self,
        device_id: &str,
        packages: Vec<Vec<u8>>,
    ) -> Result<usize, DeliveryError> {
        self.storage.publish_key_packages(device_id, packages).await
    }

    pub async fn claim_key_package(&self, device_id: &str) -> Result<Vec<u8>, DeliveryError> {
        self.storage.claim_key_package(device_id).await
    }

    pub async fn create_group(
        &self,
        group_id: &str,
        disappearing_ttl_seconds: Option<i32>,
    ) -> Result<MlsGroupRecord, DeliveryError> {
        self.storage
            .create_group(group_id, disappearing_ttl_seconds)
            .await
    }

    pub async fn get_group(&self, group_id: &str) -> Result<Option<MlsGroupRecord>, DeliveryError> {
        self.storage.get_group(group_id).await
    }

    pub async fn post_commit(
        &self,
        group_id: &str,
        epoch: u64,
        commit_bytes: &[u8],
        welcome_bytes: Option<&[u8]>,
    ) -> Result<u64, DeliveryError> {
        self.storage
            .post_commit(group_id, epoch, commit_bytes, welcome_bytes)
            .await
    }

    pub async fn get_commit(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError> {
        self.storage.get_commit(group_id, epoch).await
    }

    pub async fn get_welcome(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError> {
        self.storage.get_welcome(group_id, epoch).await
    }

    pub async fn post_ciphertext(
        &self,
        group_id: &str,
        epoch: u64,
        message_id: &str,
        ciphertext: &[u8],
    ) -> Result<CiphertextRecord, DeliveryError> {
        self.storage
            .post_ciphertext(group_id, epoch, message_id, ciphertext)
            .await
    }

    pub async fn get_ciphertext_history(
        &self,
        group_id: &str,
        member_join_epoch: u64,
        before_message_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<CiphertextRecord>, DeliveryError> {
        self.storage
            .get_ciphertext_history(group_id, member_join_epoch, before_message_id, limit)
            .await
    }
}

pub struct PostgresDeliveryStorage {
    pool: Pool,
}

impl PostgresDeliveryStorage {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl DeliveryStorage for PostgresDeliveryStorage {
    async fn ensure_schema(&self) -> Result<(), DeliveryError> {
        let mut client = self.pool.get().await?;
        let transaction = client.transaction().await?;
        transaction
            .query_one(
                "SELECT set_config('statement_timeout', $1, true)",
                &[&POSTGRES_MLS_SCHEMA_LOCK_TIMEOUT],
            )
            .await?;
        transaction
            .query_one(
                "SELECT pg_advisory_xact_lock($1, 1)",
                &[&POSTGRES_MLS_SCHEMA_LOCK_NAMESPACE],
            )
            .await?;

        transaction
            .batch_execute(
                r#"
CREATE TABLE IF NOT EXISTS mls_key_packages (
    key_package_hash text PRIMARY KEY,
    device_id text NOT NULL,
    key_package_bytes bytea NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mls_key_packages_unconsumed_idx
ON mls_key_packages (device_id, created_at)
WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS mls_groups (
    group_id text PRIMARY KEY,
    current_epoch bigint NOT NULL DEFAULT 0,
    disappearing_ttl_seconds integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mls_commits (
    group_id text NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
    epoch bigint NOT NULL,
    commit_bytes bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, epoch)
);

CREATE TABLE IF NOT EXISTS mls_welcomes (
    group_id text NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
    epoch bigint NOT NULL,
    welcome_bytes bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, epoch)
);

CREATE TABLE IF NOT EXISTS mls_ciphertext_messages (
    group_id text NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
    epoch bigint NOT NULL,
    message_id text NOT NULL,
    ciphertext bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    PRIMARY KEY (group_id, message_id)
);

CREATE INDEX IF NOT EXISTS mls_ciphertext_messages_history_idx
ON mls_ciphertext_messages (group_id, epoch, created_at DESC, message_id DESC);

CREATE INDEX IF NOT EXISTS mls_ciphertext_messages_expires_idx
ON mls_ciphertext_messages (expires_at)
WHERE expires_at IS NOT NULL;
"#,
            )
            .await?;

        transaction.commit().await?;
        Ok(())
    }

    async fn publish_key_packages(
        &self,
        device_id: &str,
        packages: Vec<Vec<u8>>,
    ) -> Result<usize, DeliveryError> {
        if packages.is_empty() {
            return Ok(0);
        }
        let client = self.pool.get().await?;
        let mut inserted = 0;
        for pkg in packages {
            let hash = hex::encode(Sha256::digest(&pkg));
            let rows = client
                .execute(
                    "INSERT INTO mls_key_packages (key_package_hash, device_id, key_package_bytes, created_at)
                     VALUES ($1, $2, $3, now())
                     ON CONFLICT (key_package_hash) DO NOTHING",
                    &[&hash, &device_id, &pkg],
                )
                .await?;
            inserted += rows as usize;
        }
        Ok(inserted)
    }

    async fn claim_key_package(&self, device_id: &str) -> Result<Vec<u8>, DeliveryError> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                r#"
WITH candidate AS (
    SELECT key_package_hash
    FROM mls_key_packages
    WHERE device_id = $1 AND consumed_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE mls_key_packages
SET consumed_at = now()
FROM candidate
WHERE mls_key_packages.key_package_hash = candidate.key_package_hash
RETURNING mls_key_packages.key_package_bytes;
"#,
                &[&device_id],
            )
            .await?;

        match row {
            Some(row) => Ok(row.get::<_, Vec<u8>>("key_package_bytes")),
            None => Err(DeliveryError::KeyPackageExhaustion(device_id.to_string())),
        }
    }

    async fn create_group(
        &self,
        group_id: &str,
        disappearing_ttl_seconds: Option<i32>,
    ) -> Result<MlsGroupRecord, DeliveryError> {
        let client = self.pool.get().await?;
        let row = client
            .query_one(
                r#"
INSERT INTO mls_groups (group_id, current_epoch, disappearing_ttl_seconds, created_at, updated_at)
VALUES ($1, 0, $2, now(), now())
ON CONFLICT (group_id) DO UPDATE
SET disappearing_ttl_seconds = EXCLUDED.disappearing_ttl_seconds, updated_at = now()
RETURNING group_id, current_epoch, disappearing_ttl_seconds, created_at, updated_at;
"#,
                &[&group_id, &disappearing_ttl_seconds],
            )
            .await?;

        Ok(MlsGroupRecord {
            group_id: row.get("group_id"),
            current_epoch: row.get::<_, i64>("current_epoch") as u64,
            disappearing_ttl_seconds: row.get("disappearing_ttl_seconds"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn get_group(&self, group_id: &str) -> Result<Option<MlsGroupRecord>, DeliveryError> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                "SELECT group_id, current_epoch, disappearing_ttl_seconds, created_at, updated_at
                 FROM mls_groups WHERE group_id = $1",
                &[&group_id],
            )
            .await?;

        Ok(row.map(|row| MlsGroupRecord {
            group_id: row.get("group_id"),
            current_epoch: row.get::<_, i64>("current_epoch") as u64,
            disappearing_ttl_seconds: row.get("disappearing_ttl_seconds"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }))
    }

    async fn post_commit(
        &self,
        group_id: &str,
        epoch: u64,
        commit_bytes: &[u8],
        welcome_bytes: Option<&[u8]>,
    ) -> Result<u64, DeliveryError> {
        let mut client = self.pool.get().await?;
        let transaction = client.transaction().await?;

        let group_row = transaction
            .query_opt(
                "SELECT current_epoch FROM mls_groups WHERE group_id = $1 FOR UPDATE",
                &[&group_id],
            )
            .await?;

        let Some(group_row) = group_row else {
            return Err(DeliveryError::GroupNotFound(group_id.to_string()));
        };

        let current_epoch = group_row.get::<_, i64>("current_epoch") as u64;
        if epoch != current_epoch + 1 {
            return Err(DeliveryError::EpochConflict {
                current_epoch,
                requested_epoch: epoch,
            });
        }

        let epoch_i64 = epoch as i64;
        transaction
            .execute(
                "INSERT INTO mls_commits (group_id, epoch, commit_bytes, created_at)
                 VALUES ($1, $2, $3, now())",
                &[&group_id, &epoch_i64, &commit_bytes],
            )
            .await?;

        if let Some(welcome) = welcome_bytes {
            transaction
                .execute(
                    "INSERT INTO mls_welcomes (group_id, epoch, welcome_bytes, created_at)
                     VALUES ($1, $2, $3, now())",
                    &[&group_id, &epoch_i64, &welcome],
                )
                .await?;
        }

        transaction
            .execute(
                "UPDATE mls_groups SET current_epoch = $2, updated_at = now() WHERE group_id = $1",
                &[&group_id, &epoch_i64],
            )
            .await?;

        transaction.commit().await?;
        Ok(epoch)
    }

    async fn get_commit(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError> {
        let client = self.pool.get().await?;
        let epoch_i64 = epoch as i64;
        let row = client
            .query_opt(
                "SELECT commit_bytes FROM mls_commits WHERE group_id = $1 AND epoch = $2",
                &[&group_id, &epoch_i64],
            )
            .await?;
        Ok(row.map(|row| row.get("commit_bytes")))
    }

    async fn get_welcome(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError> {
        let client = self.pool.get().await?;
        let epoch_i64 = epoch as i64;
        let row = client
            .query_opt(
                "SELECT welcome_bytes FROM mls_welcomes WHERE group_id = $1 AND epoch = $2",
                &[&group_id, &epoch_i64],
            )
            .await?;
        Ok(row.map(|row| row.get("welcome_bytes")))
    }

    async fn post_ciphertext(
        &self,
        group_id: &str,
        epoch: u64,
        message_id: &str,
        ciphertext: &[u8],
    ) -> Result<CiphertextRecord, DeliveryError> {
        let client = self.pool.get().await?;
        let group_row = client
            .query_opt(
                "SELECT disappearing_ttl_seconds FROM mls_groups WHERE group_id = $1",
                &[&group_id],
            )
            .await?;

        let Some(group_row) = group_row else {
            return Err(DeliveryError::GroupNotFound(group_id.to_string()));
        };

        let ttl_secs: Option<i32> = group_row.get("disappearing_ttl_seconds");
        let expires_at = ttl_secs
            .filter(|ttl| *ttl > 0)
            .map(|ttl| Utc::now() + Duration::seconds(ttl as i64));

        let epoch_i64 = epoch as i64;
        let row = client
            .query_one(
                r#"
INSERT INTO mls_ciphertext_messages (group_id, epoch, message_id, ciphertext, created_at, expires_at)
VALUES ($1, $2, $3, $4, now(), $5)
RETURNING group_id, epoch, message_id, ciphertext, created_at, expires_at;
"#,
                &[&group_id, &epoch_i64, &message_id, &ciphertext, &expires_at],
            )
            .await?;

        Ok(CiphertextRecord {
            group_id: row.get("group_id"),
            epoch: row.get::<_, i64>("epoch") as u64,
            message_id: row.get("message_id"),
            ciphertext: row.get("ciphertext"),
            created_at: row.get("created_at"),
            expires_at: row.get("expires_at"),
        })
    }

    async fn get_ciphertext_history(
        &self,
        group_id: &str,
        member_join_epoch: u64,
        before_message_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<CiphertextRecord>, DeliveryError> {
        let client = self.pool.get().await?;
        let join_epoch_i64 = member_join_epoch as i64;
        let limit_i64 = (limit.clamp(1, 100)) as i64;

        let rows = if let Some(before_id) = before_message_id {
            let cursor_row = client
                .query_opt(
                    "SELECT created_at FROM mls_ciphertext_messages WHERE group_id = $1 AND message_id = $2",
                    &[&group_id, &before_id],
                )
                .await?;

            if let Some(cursor) = cursor_row {
                let cursor_created_at: DateTime<Utc> = cursor.get("created_at");
                client
                    .query(
                        r#"
SELECT group_id, epoch, message_id, ciphertext, created_at, expires_at
FROM mls_ciphertext_messages
WHERE group_id = $1
  AND epoch >= $2
  AND (expires_at IS NULL OR expires_at > now())
  AND (created_at, message_id) < ($3, $4)
ORDER BY created_at DESC, message_id DESC
LIMIT $5;
"#,
                        &[&group_id, &join_epoch_i64, &cursor_created_at, &before_id, &limit_i64],
                    )
                    .await?
            } else {
                client
                    .query(
                        r#"
SELECT group_id, epoch, message_id, ciphertext, created_at, expires_at
FROM mls_ciphertext_messages
WHERE group_id = $1
  AND epoch >= $2
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC, message_id DESC
LIMIT $3;
"#,
                        &[&group_id, &join_epoch_i64, &limit_i64],
                    )
                    .await?
            }
        } else {
            client
                .query(
                    r#"
SELECT group_id, epoch, message_id, ciphertext, created_at, expires_at
FROM mls_ciphertext_messages
WHERE group_id = $1
  AND epoch >= $2
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC, message_id DESC
LIMIT $3;
"#,
                    &[&group_id, &join_epoch_i64, &limit_i64],
                )
                .await?
        };

        let records = rows
            .into_iter()
            .map(|row| CiphertextRecord {
                group_id: row.get("group_id"),
                epoch: row.get::<_, i64>("epoch") as u64,
                message_id: row.get("message_id"),
                ciphertext: row.get("ciphertext"),
                created_at: row.get("created_at"),
                expires_at: row.get("expires_at"),
            })
            .collect();

        Ok(records)
    }
}

#[derive(Default)]
pub struct InMemoryDeliveryStorage {
    key_packages: RwLock<Vec<KeyPackageRecord>>,
    groups: RwLock<HashMap<String, MlsGroupRecord>>,
    commits: RwLock<HashMap<(String, u64), Vec<u8>>>,
    welcomes: RwLock<HashMap<(String, u64), Vec<u8>>>,
    ciphertext_messages: RwLock<Vec<CiphertextRecord>>,
}

impl InMemoryDeliveryStorage {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait::async_trait]
impl DeliveryStorage for InMemoryDeliveryStorage {
    async fn ensure_schema(&self) -> Result<(), DeliveryError> {
        Ok(())
    }

    async fn publish_key_packages(
        &self,
        device_id: &str,
        packages: Vec<Vec<u8>>,
    ) -> Result<usize, DeliveryError> {
        let mut store = self.key_packages.write().await;
        let mut inserted = 0;
        let now = Utc::now();
        for pkg in packages {
            let hash = hex::encode(Sha256::digest(&pkg));
            if !store.iter().any(|p| p.key_package_hash == hash) {
                store.push(KeyPackageRecord {
                    key_package_hash: hash,
                    device_id: device_id.to_string(),
                    key_package_bytes: pkg,
                    consumed_at: None,
                    created_at: now,
                });
                inserted += 1;
            }
        }
        Ok(inserted)
    }

    async fn claim_key_package(&self, device_id: &str) -> Result<Vec<u8>, DeliveryError> {
        let mut store = self.key_packages.write().await;
        let candidate = store
            .iter_mut()
            .filter(|p| p.device_id == device_id && p.consumed_at.is_none())
            .min_by_key(|p| p.created_at);

        match candidate {
            Some(pkg) => {
                pkg.consumed_at = Some(Utc::now());
                Ok(pkg.key_package_bytes.clone())
            }
            None => Err(DeliveryError::KeyPackageExhaustion(device_id.to_string())),
        }
    }

    async fn create_group(
        &self,
        group_id: &str,
        disappearing_ttl_seconds: Option<i32>,
    ) -> Result<MlsGroupRecord, DeliveryError> {
        let mut groups = self.groups.write().await;
        let now = Utc::now();
        let record = groups
            .entry(group_id.to_string())
            .and_modify(|g| {
                g.disappearing_ttl_seconds = disappearing_ttl_seconds;
                g.updated_at = now;
            })
            .or_insert_with(|| MlsGroupRecord {
                group_id: group_id.to_string(),
                current_epoch: 0,
                disappearing_ttl_seconds,
                created_at: now,
                updated_at: now,
            })
            .clone();
        Ok(record)
    }

    async fn get_group(&self, group_id: &str) -> Result<Option<MlsGroupRecord>, DeliveryError> {
        let groups = self.groups.read().await;
        Ok(groups.get(group_id).cloned())
    }

    async fn post_commit(
        &self,
        group_id: &str,
        epoch: u64,
        commit_bytes: &[u8],
        welcome_bytes: Option<&[u8]>,
    ) -> Result<u64, DeliveryError> {
        let mut groups = self.groups.write().await;
        let group = groups
            .get_mut(group_id)
            .ok_or_else(|| DeliveryError::GroupNotFound(group_id.to_string()))?;

        if epoch != group.current_epoch + 1 {
            return Err(DeliveryError::EpochConflict {
                current_epoch: group.current_epoch,
                requested_epoch: epoch,
            });
        }

        let mut commits = self.commits.write().await;
        commits.insert((group_id.to_string(), epoch), commit_bytes.to_vec());

        if let Some(welcome) = welcome_bytes {
            let mut welcomes = self.welcomes.write().await;
            welcomes.insert((group_id.to_string(), epoch), welcome.to_vec());
        }

        group.current_epoch = epoch;
        group.updated_at = Utc::now();
        Ok(epoch)
    }

    async fn get_commit(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError> {
        let commits = self.commits.read().await;
        Ok(commits.get(&(group_id.to_string(), epoch)).cloned())
    }

    async fn get_welcome(&self, group_id: &str, epoch: u64) -> Result<Option<Vec<u8>>, DeliveryError> {
        let welcomes = self.welcomes.read().await;
        Ok(welcomes.get(&(group_id.to_string(), epoch)).cloned())
    }

    async fn post_ciphertext(
        &self,
        group_id: &str,
        epoch: u64,
        message_id: &str,
        ciphertext: &[u8],
    ) -> Result<CiphertextRecord, DeliveryError> {
        let groups = self.groups.read().await;
        let group = groups
            .get(group_id)
            .ok_or_else(|| DeliveryError::GroupNotFound(group_id.to_string()))?;

        let expires_at = group
            .disappearing_ttl_seconds
            .filter(|ttl| *ttl > 0)
            .map(|ttl| Utc::now() + Duration::seconds(ttl as i64));

        let record = CiphertextRecord {
            group_id: group_id.to_string(),
            epoch,
            message_id: message_id.to_string(),
            ciphertext: ciphertext.to_vec(),
            created_at: Utc::now(),
            expires_at,
        };

        let mut messages = self.ciphertext_messages.write().await;
        messages.retain(|m| !(m.group_id == group_id && m.message_id == message_id));
        messages.push(record.clone());
        Ok(record)
    }

    async fn get_ciphertext_history(
        &self,
        group_id: &str,
        member_join_epoch: u64,
        before_message_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<CiphertextRecord>, DeliveryError> {
        let messages = self.ciphertext_messages.read().await;
        let now = Utc::now();
        let limit = limit.clamp(1, 100);

        let mut matching: Vec<CiphertextRecord> = messages
            .iter()
            .filter(|m| {
                m.group_id == group_id
                    && m.epoch >= member_join_epoch
                    && m.expires_at.map_or(true, |exp| exp > now)
            })
            .cloned()
            .collect();

        matching.sort_by(|a, b| {
            b.created_at
                .cmp(&a.created_at)
                .then_with(|| b.message_id.cmp(&a.message_id))
        });

        if let Some(before_id) = before_message_id {
            if let Some(cursor_pos) = matching.iter().position(|m| m.message_id == before_id) {
                let paged: Vec<CiphertextRecord> = matching
                    .into_iter()
                    .skip(cursor_pos + 1)
                    .take(limit)
                    .collect();
                return Ok(paged);
            }
        }

        let paged: Vec<CiphertextRecord> = matching.into_iter().take(limit).collect();
        Ok(paged)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_publish_and_claim_key_packages_until_exhaustion() {
        let storage = InMemoryDeliveryStorage::new();
        let service = DeliveryService::new(storage);

        let device_id = "device_alice_1";
        let pkg1 = b"pkg_1".to_vec();
        let pkg2 = b"pkg_2".to_vec();
        let pkg3 = b"pkg_3".to_vec();

        let inserted = service
            .publish_key_packages(device_id, vec![pkg1.clone(), pkg2.clone(), pkg3.clone()])
            .await
            .expect("publish succeeds");
        assert_eq!(inserted, 3);

        // Claiming gives packages in order
        let c1 = service.claim_key_package(device_id).await.expect("c1");
        assert_eq!(c1, pkg1);

        let c2 = service.claim_key_package(device_id).await.expect("c2");
        assert_eq!(c2, pkg2);

        let c3 = service.claim_key_package(device_id).await.expect("c3");
        assert_eq!(c3, pkg3);

        // Fourth claim must fail with KeyPackageExhaustion
        let c4 = service.claim_key_package(device_id).await;
        assert_eq!(
            c4.unwrap_err(),
            DeliveryError::KeyPackageExhaustion(device_id.to_string())
        );
    }

    #[tokio::test]
    async fn test_single_commit_per_epoch_and_conflict_rejection() {
        let storage = InMemoryDeliveryStorage::new();
        let service = DeliveryService::new(storage);

        let group_id = "group_123";
        service
            .create_group(group_id, None)
            .await
            .expect("group created");

        let group = service.get_group(group_id).await.unwrap().unwrap();
        assert_eq!(group.current_epoch, 0);

        // Commit to epoch 1 succeeds
        let epoch1 = service
            .post_commit(group_id, 1, b"commit_epoch_1", Some(b"welcome_epoch_1"))
            .await
            .expect("commit 1 succeeds");
        assert_eq!(epoch1, 1);

        let group = service.get_group(group_id).await.unwrap().unwrap();
        assert_eq!(group.current_epoch, 1);

        // Concurrent commit to epoch 1 is rejected with EpochConflict
        let conflict = service
            .post_commit(group_id, 1, b"competing_commit_1", None)
            .await;
        assert_eq!(
            conflict.unwrap_err(),
            DeliveryError::EpochConflict {
                current_epoch: 1,
                requested_epoch: 1,
            }
        );

        // Stale commit to epoch 0 is rejected
        let stale = service.post_commit(group_id, 0, b"stale_commit_0", None).await;
        assert_eq!(
            stale.unwrap_err(),
            DeliveryError::EpochConflict {
                current_epoch: 1,
                requested_epoch: 0,
            }
        );

        // Skipping epoch (e.g. attempting epoch 3 when epoch is 1) is rejected
        let skipped = service
            .post_commit(group_id, 3, b"future_commit_3", None)
            .await;
        assert_eq!(
            skipped.unwrap_err(),
            DeliveryError::EpochConflict {
                current_epoch: 1,
                requested_epoch: 3,
            }
        );

        // Next valid commit must be epoch 2
        let epoch2 = service
            .post_commit(group_id, 2, b"commit_epoch_2", None)
            .await
            .expect("commit 2 succeeds");
        assert_eq!(epoch2, 2);

        // Verify retrieval of commit and welcome
        let retrieved_commit = service.get_commit(group_id, 1).await.unwrap();
        assert_eq!(retrieved_commit, Some(b"commit_epoch_1".to_vec()));

        let retrieved_welcome = service.get_welcome(group_id, 1).await.unwrap();
        assert_eq!(retrieved_welcome, Some(b"welcome_epoch_1".to_vec()));
    }

    #[tokio::test]
    async fn test_ciphertext_history_pagination_and_member_join_epoch() {
        let storage = InMemoryDeliveryStorage::new();
        let service = DeliveryService::new(storage);

        let group_id = "group_abc";
        service.create_group(group_id, None).await.unwrap();

        // Message 1 at epoch 0
        service
            .post_ciphertext(group_id, 0, "msg_0", b"cipher_0")
            .await
            .unwrap();
        // Message 2 at epoch 1
        service
            .post_ciphertext(group_id, 1, "msg_1", b"cipher_1")
            .await
            .unwrap();
        // Message 3 at epoch 2
        service
            .post_ciphertext(group_id, 2, "msg_2", b"cipher_2")
            .await
            .unwrap();
        // Message 4 at epoch 2
        service
            .post_ciphertext(group_id, 2, "msg_3", b"cipher_3")
            .await
            .unwrap();

        // New member joined at epoch 1 (ADR-0012 v1 rule)
        let history = service
            .get_ciphertext_history(group_id, 1, None, 10)
            .await
            .unwrap();

        // msg_0 from epoch 0 must NOT be visible to member who joined at epoch 1!
        let msg_ids: Vec<&str> = history.iter().map(|m| m.message_id.as_str()).collect();
        assert!(!msg_ids.contains(&"msg_0"));
        assert!(msg_ids.contains(&"msg_1"));
        assert!(msg_ids.contains(&"msg_2"));
        assert!(msg_ids.contains(&"msg_3"));

        // Pagination test with limit = 2
        let page1 = service
            .get_ciphertext_history(group_id, 1, None, 2)
            .await
            .unwrap();
        assert_eq!(page1.len(), 2);

        let last_id = &page1.last().unwrap().message_id;
        let page2 = service
            .get_ciphertext_history(group_id, 1, Some(last_id), 2)
            .await
            .unwrap();
        assert_eq!(page2.len(), 1);
        assert_eq!(page2[0].message_id, "msg_1");
    }

    #[tokio::test]
    async fn test_disappearing_messages_ttl() {
        let storage = Arc::new(InMemoryDeliveryStorage::new());
        let service = DeliveryService::from_arc(storage.clone());

        let group_id = "group_disappearing";
        // Create group with 10s TTL
        service.create_group(group_id, Some(10)).await.unwrap();

        let rec = service
            .post_ciphertext(group_id, 1, "msg_timed", b"cipher_timed")
            .await
            .unwrap();
        assert!(rec.expires_at.is_some());

        // Normal retrieval before expiration returns the message
        let history = service
            .get_ciphertext_history(group_id, 0, None, 10)
            .await
            .unwrap();
        assert_eq!(history.len(), 1);

        // Manually insert an already expired message
        {
            let mut messages = storage.ciphertext_messages.write().await;
            messages.push(CiphertextRecord {
                group_id: group_id.to_string(),
                epoch: 1,
                message_id: "msg_expired".to_string(),
                ciphertext: b"expired".to_vec(),
                created_at: Utc::now() - Duration::seconds(20),
                expires_at: Some(Utc::now() - Duration::seconds(10)),
            });
        }

        let history_after = service
            .get_ciphertext_history(group_id, 0, None, 10)
            .await
            .unwrap();
        let ids: Vec<&str> = history_after.iter().map(|m| m.message_id.as_str()).collect();
        assert!(!ids.contains(&"msg_expired"));
        assert!(ids.contains(&"msg_timed"));
    }
}
