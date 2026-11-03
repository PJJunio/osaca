---
title: "ADR-0012: Encrypted history stored on the server"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q20, Q22]
phase: F1
---

# ADR-0012: Encrypted history stored on the server

## Context
A Discord-style experience needs scrollback and sync. In MLS, new members cannot decrypt messages from before they joined.

## Decision
- The server **stores ciphertext permanently**. Disappearing messages are an optional per-channel setting.
- **v1: no history for new members.** They see messages from their join onwards.
- **F4:** a per-channel setting lets a current Member, for example a Moderator, send newcomers an encrypted **history bundle**.

## Alternatives considered
- **Store-and-forward only, as in Signal.** Rejected because it breaks the scrollback that users expect from a Discord-style app.
