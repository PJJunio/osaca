---
title: "ADR-0004: MLS via OpenMLS for all E2EE"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - security
decisions: [Q10, Q26]
phase: F1
---

# ADR-0004: MLS via OpenMLS for all E2EE

## Context
OSACA needs E2EE for both DMs and large groups. The team is part-time, so a single audited protocol and library is far cheaper than two.

## Decision
- **[[GLOSSARY#MLS|MLS]] (RFC 9420)**, through the **OpenMLS** Rust library, is used for every Private Conversation and every Community.
- A new crate, **`osaca_crypto`**, wraps OpenMLS and compiles to **WASM**. The same code runs in the web client and in Electron, and later on mobile through uniffi. It reuses the existing Rust → WASM toolchain (`libfluxcore`).
- A new Rust **[[GLOSSARY#Delivery Service|Delivery Service]]**, built on `fluxer_svc`:
  - stores KeyPackages;
  - orders Commits per group (MLS requires one Commit per Epoch);
  - stores ciphertext.

  It never holds keys.
- The rest of the stack stays as it is: the TS API, the Erlang gateway and the Rust services.

## Consequences
- The server cannot read content, and adding or removing members costs O(log n).
- Clients must handle Commit conflicts and Epoch changes.

## Alternatives considered
- **Signal with Sender Keys (libsignal).** Excellent for DMs, but it scales poorly in large groups and removing a member is expensive.
- **Megolm (Matrix).** Has a history of security problems, and Matrix itself is moving to MLS.
- **Rewriting the stack.** Not realistic at about 1.3M LOC.
