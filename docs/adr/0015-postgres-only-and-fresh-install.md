---
title: "ADR-0015: Postgres only and fresh install"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q27, Q28]
phase: F0
---

# ADR-0015: Postgres only and fresh install

## Decision
- **Postgres is the only database.** Cassandra/Scylla support is removed.
- **Meilisearch and Elasticsearch are removed.** The [[GLOSSARY#Community Directory|Community Directory]] uses Postgres full-text search.
- Valkey, NATS, SeaweedFS and LiveKit stay.
- **New ciphertext tables** (group, epoch, ciphertext, timestamp) replace the plaintext message fields: `content`, `embeds`, `mentions` and reactions.
- **Fresh install only.** Data from existing Fluxer instances is not migrated. Migrating plaintext into E2EE is meaningless, because the server has already seen it.

## Consequences
Smaller VPS footprint, less code to maintain, less data to leak.
