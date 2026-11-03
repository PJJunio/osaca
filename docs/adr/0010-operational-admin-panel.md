---
title: "ADR-0010: Operational-only admin panel"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q8]
phase: F0
---

# ADR-0010: Operational-only admin panel

## Context
Fluxer's admin panel (`fluxer_admin`) can read any channel or DM, see IPs with reverse DNS and location, change a user's email, disable MFA and generate user archives. Each of these defeats [[0002-threat-model]].

## Decision
- **Removed:** message lookup and search, DM and relationship listing, IP and location views, email changes, MFA reset, user archives.
- **Kept:** banning Accounts, deleting reported content, Instance configuration, aggregate metrics, and the reports queue.

## Consequences
The Operator cannot recover a user's Account. Recovery relies entirely on the [[GLOSSARY#Recovery Kit|Recovery Kit]].
