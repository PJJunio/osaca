---
title: "ADR-0007: Signed membership and roles"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - security
decisions: [Q19]
phase: F2
---

# ADR-0007: Signed membership and roles

## Context
If the server alone decides who joins an MLS Group or who holds a role, a malicious Operator can add themselves, or a fake Device, as a [[GLOSSARY#Ghost Member|Ghost Member]] and read everything. Without this protection, group E2EE is decorative against [[0002-threat-model]] case b.

> [!danger] Security boundary
> This is the most delicate part of the whole project. It needs a written specification and external review **before** F2 code.

## Decision
- Membership and role changes are **[[GLOSSARY#Signed Governance Event|Signed Governance Events]]**, signed by [[GLOSSARY#Governance Key|Governance Keys]] held by the Community Owner and delegated to Moderators. Every client verifies them; the server only relays them.
- Joining a Community requires an **invite signed** by a Member with permission. The joiner enters through an MLS **external commit**.
- The UI **shows every member or Device join** in a channel and **alerts on any leaf without a valid signature**.
- Permissions that do not affect cryptography, such as rate limits and slowmode, stay server-enforced.

## Consequences
Losing the Owner's Governance Key must not orphan a Community. Key recovery and delegation have to be designed as part of this specification.
