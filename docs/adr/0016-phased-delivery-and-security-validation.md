---
title: "ADR-0016: Phased delivery and security validation"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - roadmap
decisions: [Q5, Q30, Q31]
phase: F0
---

# ADR-0016: Phased delivery and security validation

## Context
The work is part-time with occasional helpers (Q5), so each phase has to be usable on its own and must not depend on people being available for the next one.

## Decision
- **Principles:**
  - Audited libraries only; no hand-rolled cryptography.
  - Delete before building: code that does not serve OSACA is removed, not adapted.
- **Phases:**
  1. **F0 – Fluxer without surveillance**: rename and removals ([[0001-hard-fork-as-osaca]], [[0009-metadata-minimisation-and-anonymous-accounts]], [[0010-operational-admin-panel]], [[0015-postgres-only-and-fresh-install]]).
  2. **F1 – E2EE DMs and group DMs** ([[0004-mls-with-openmls]], [[0005-key-verification]], [[0008-no-server-side-content-processing]]).
  3. **F2 – E2EE Communities and voice** ([[0006-mls-group-topology]], [[0007-signed-membership-and-roles]], [[0014-voice-e2ee-from-mls]]).
  4. **F3 – Multi-device** ([[0013-multi-device]]).
  5. **F4 – Later:**
     - shared history ([[0012-encrypted-history-on-server]]);
     - encrypted profiles;
     - Key Transparency and Message Franking;
     - mobile, an IPFS web build and an official `.onion`.
- **Security validation:**
  - Label releases **"experimental, unaudited"** until an external audit.
  - Publish the threat model ([[0002-threat-model]]) and a protocol specification.
  - Write **security property tests**, for example "the server never receives plaintext" and "an unsigned leaf raises an alert".
  - Apply for **NLnet (NGI Zero)** funding, which includes a security audit.
