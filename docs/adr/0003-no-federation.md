---
title: "ADR-0003: No federation"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q3]
phase: F0
---

# ADR-0003: No federation

## Context
Fluxer is single-instance. Its ActivityPub support is only an "Application" actor used for unfurl fetches. Federation would spread metadata to other Operators and multiply the complexity of the cryptography.

## Decision
Each [[GLOSSARY#Instance|Instance]] is isolated, and an Account lives on one Instance. The client may hold Accounts on several Instances, which Fluxer already supports. The ActivityPub actor is removed together with server-side unfurl ([[0008-no-server-side-content-processing]]).

## Consequences
There is no cross-instance messaging. This can be revisited after F4 if a privacy-preserving design emerges.
