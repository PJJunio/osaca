---
title: "ADR-0011: Client platforms"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - security
decisions: [Q6]
phase: F1
---

# ADR-0011: Client platforms

## Context
A web client served by the Instance can be replaced by a malicious Operator with tampered JavaScript, which defeats E2EE ([[0002-threat-model]] case b). The mobile clients are not in this repository.

## Decision
- **Desktop (Electron)** is the reference client for v1.
- **Web** exists only as a **signed, reproducible static build hosted outside the Instance**, for example on an official OSACA site and later on IPFS. It is never served by `fluxer_app_proxy` on an Instance.
- **Mobile** is deferred to F4.

## Consequences
`fluxer_app_proxy` is repurposed or removed. Build reproducibility and signature verification become release requirements.
