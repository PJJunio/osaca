---
title: "ADR-0006: MLS group topology"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q18]
phase: F2
---

# ADR-0006: MLS group topology

## Context
Discord-style Communities have many channels with different audiences. One MLS group per channel is simple but costly: a user in 50 channels maintains 50 groups, and joining a Community triggers dozens of Commits.

## Decision
- **One [[GLOSSARY#MLS Group|MLS Group]] per Private Conversation.**
- **One MLS Group per Community**, covering every Public Channel (`@everyone`).
- **One MLS Group per Private Channel.**

## Consequences
This covers roughly 90% of cases with a single group per Community and keeps real isolation where it matters. Changing a channel between public and private means a key migration, and the UI must make that explicit.

## Alternatives considered
- **One group per channel.** Too many groups.
- **One group per audience** (each set of channels with identical membership). Optimal, but too complex for v1.

Open: threads and forums, see [[osaca-technical-survey#7. Open questions]].
