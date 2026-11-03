---
title: Fluxer Docs Rewrite Plan
aliases:
  - Docs Rewrite Plan
tags:
  - osaca
  - docs
  - plan
status: accepted
created: 2026-11-03
---

# Fluxer Docs Rewrite Plan

This plan reshapes the inherited documentation site (`fluxer_docs/`, built with Astro Starlight; content in `fluxer_docs/src/content/docs/`) for OSACA. It follows the decisions in [[osaca-technical-survey]] and uses the vocabulary in [[GLOSSARY]].

Verdicts:
- **Keep**: still accurate, needs only the rename.
- **Adapt**: the structure stays but the content changes.
- **Rewrite**: the behaviour changes fundamentally.
- **Remove**: the feature is gone.
- **New**: does not exist yet.

> [!info] When
> The directory moves to `osaca_docs/` in the rename commit ([[0001-hard-fork-as-osaca]]). Each page is updated **in the same PR as the code change it describes**, never ahead of it.

## Top level

| Page | Verdict | Notes |
| --- | --- | --- |
| `index.md` | Rewrite | OSACA positioning, the "experimental, unaudited" banner and a link to the threat model |
| `authentication.md` | Rewrite | Username-only accounts, Recovery Kit, Device keys ([[0009-metadata-minimisation-and-anonymous-accounts]]) |
| `snowflakes.md` | Keep | |

## `operator/`

| Page | Verdict | Notes |
| --- | --- | --- |
| `index`, `running`, `rexctl`, `environment` | Adapt | Remove Cassandra, Meilisearch, Elasticsearch, GeoIP and the Stripe config ([[0015-postgres-only-and-fresh-install]]) |
| `docker-compose`, `kubernetes`, `reverse-proxy` | Adapt | Fewer services. The reverse proxy no longer serves the web client ([[0011-client-platforms]]) |
| `sign-in` | Rewrite | Username-only. Email and OIDC are removed |
| `voice-compose`, `voice-servers` | Adapt | LiveKit stays; the server no longer issues voice keys |
| **New:** `operator/what-you-can-see` | New | Exactly what the Operator can and cannot see, plus the legal exposure ([[0008-no-server-side-content-processing]]) |
| **New:** `operator/onion` | New | Running an Instance as a Tor `.onion` service |

## `admin-api/`

| Page | Verdict | Notes |
| --- | --- | --- |
| `messages`, `archives`, `search-indexes`, `gift-codes`, `system-dms` | Remove | [[0010-operational-admin-panel]] |
| `users` | Rewrite | No IPs, no email changes, no MFA reset |
| `guilds`, `reports`, `enforcement`, `blocklists` | Adapt | Reports carry the decrypted message submitted by the reporter |
| `api-keys`, `applications`, `badges`, `bulk-jobs`, `discovery`, `gateway`, `instance`, `jobs`, `threads`, `voice`, `index` | Adapt | Review each for content or metadata access |

## `http-api/`

| Page | Verdict | Notes |
| --- | --- | --- |
| `billing`, `premium`, `gifts`, `users/gifts`, `gifs`, `memes`, `unfurl`, `search`, `users/email-and-password`, `connections`, `users/data-harvest` | Remove | Removed features. Data export moves to the client |
| `messages`, `channels`, `threads`, `forums`, `read-states` | Rewrite | Ciphertext envelopes, MLS groups, client-side mentions ([[0008-no-server-side-content-processing]]) |
| `guilds`, `guild-members`, `guild-channels`, `invites`, `permissions` | Rewrite | Signed Governance Events and signed invites ([[0007-signed-membership-and-roles]]) |
| `users/push-notifications` | Rewrite | Wake-up Push only |
| `users/private-channels`, `users/relationships`, `users/settings*`, `users/current-user`, `users/mfa`, `users/notes`, `users/content`, `users` | Adapt | Remove email and date-of-birth fields. Notes and settings become client-encrypted |
| `peer-to-peer-voice`, `calls`, `streams` | Adapt | Voice keys come from MLS ([[0014-voice-e2ee-from-mls]]) |
| `guild-audit-logs`, `guild-moderation`, `guild-member-search`, `guild-emojis`, `guild-stickers`, `expressions`, `entrance-sounds`, `themes`, `announcement-channels`, `discovery` | Adapt | Check what each reveals to the server |
| `applications`, `oauth2`, `webhooks` | Adapt | Bot and webhook E2EE is an open question ([[osaca-technical-survey#7. Open questions]]) |
| `authentication`, `errors`, `gateway`, `instance`, `experiments`, `reports`, `deployment-availability`, `index` | Adapt | |
| **New:** `http-api/key-packages`, `http-api/delivery-service` | New | Delivery Service endpoints ([[0004-mls-with-openmls]]) |

## `gateway/`

| Page | Verdict | Notes |
| --- | --- | --- |
| `events`, `commands` | Rewrite | Opaque ciphertext events, Commit/Welcome delivery, Wake-up Push |
| `overview`, `opcodes-and-close-codes`, `limits-and-rate-limits`, `event-filtering`, `threads` | Adapt | Rate limiting without IPs |

## `media-proxy/`

| Page | Verdict | Notes |
| --- | --- | --- |
| `transformations` | Remove | Thumbnails are made on the client |
| `overview`, `routes`, `upload-relay`, `responses-and-limits` | Rewrite | Opaque encrypted blobs only |

## `topics/`, `voice/`, `downloads/`

| Page | Verdict | Notes |
| --- | --- | --- |
| `topics/captcha` | Keep | ALTCHA proof-of-work stays |
| `topics/rate-limits` | Rewrite | Token / proof-of-work based |
| `topics/uploads` | Rewrite | Client-side encryption |
| `topics/locales`, `topics/announcement-channels` | Keep | |
| `voice/index` | Rewrite | Real E2EE |
| `downloads/*` | Rewrite | OSACA channels: desktop first, signed static web |

## New top-level sections

- [ ] **Security**: threat model ([[0002-threat-model]]), what the server sees, key verification ([[0005-key-verification]]), audit status.
- [ ] **Protocol**: the MLS profile, group topology ([[0006-mls-group-topology]]), the Signed Governance Event format ([[0007-signed-membership-and-roles]]), envelope formats.
- [ ] **Architecture**: the target diagram from [[osaca-technical-survey#4. Target architecture]].
- [ ] **Contributing**: the language policy (English), the ADR process and links to `docs/adr/`.
