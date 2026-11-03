---
title: "ADR-0009: Metadata minimisation and anonymous accounts"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - privacy
decisions: [Q9, Q16, Q17, Q25]
phase: F0
---

# ADR-0009: Metadata minimisation and anonymous accounts

## Context
Fluxer stores IP addresses, user agents, country, city and coordinates, session history, DM history, Community visits and email changes, much of it without a TTL. Under [[0002-threat-model]] case c, all of it can be seized.

## Decision

**Remove entirely:**
- Billing: Stripe, app-store billing, premium and gifts (about 25 tables).
- Klipy GIFs, because GIF searches leak what users type.
- The `push.fluxer.com` relay.
- MaxMind GeoIP.

**Never store:**
- IP addresses, user agents or countries anywhere: sessions, `last_active_ip`, upload traces, logs.
- The tables `guild_visits`, `user_dm_history` and `user_contact_change_logs`.
- Short TTLs on everything operational that remains.

**Accounts:**
- Username-only. Email and OIDC/SSO are removed.
- No date of birth. Age rules become an Operator responsibility, documented and not enforced in code.
- The [[GLOSSARY#Recovery Kit|Recovery Kit]] also carries the encrypted key backup ([[0013-multi-device]]).
- Instant accounts with only a display name stay.
- Profiles in v1 are minimal plaintext: username, display name and an optional avatar. Encrypted profiles (Signal-style profile keys) come in F4.

**Network:**
- Official support for `.onion` Instances and for a SOCKS proxy in the client.
- Rate limiting and abuse prevention use ALTCHA proof-of-work and tokens, not IPs.

## Consequences
IP bans disappear, so invites plus proof-of-work have to cover abuse. The concrete design is still open ([[osaca-technical-survey#7. Open questions]]).
