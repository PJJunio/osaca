---
title: "ADR-0013: Multi-device"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q21, Q17]
phase: F3
---

# ADR-0013: Multi-device

## Decision
- Each [[GLOSSARY#Device|Device]] is a **separate leaf** in every MLS Group the Account belongs to.
- A new Device is **linked by scanning a QR code** on an existing Device, which certifies it under the Account's [[GLOSSARY#Identity Key|Identity Key]].
- Local history moves **from Device to Device directly**, never through the server.
- There is a limit of **5 Devices** per Account.
- An encrypted key backup is kept inside the [[GLOSSARY#Recovery Kit|Recovery Kit]].

## Consequences
Each extra Device enlarges every group tree it belongs to. Ghost Device detection follows the same rules as Ghost Members ([[0007-signed-membership-and-roles]]).
