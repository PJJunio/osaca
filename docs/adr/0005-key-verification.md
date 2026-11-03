---
title: "ADR-0005: Key verification with Safety Numbers"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - security
decisions: [Q7]
phase: F1
---

# ADR-0005: Key verification with Safety Numbers

## Context
A malicious Operator ([[0002-threat-model]] case b) can substitute keys and read everything through a man-in-the-middle attack, unless users can detect the substitution.

## Decision
- **v1: TOFU.** Clients trust the first key seen for a contact and show a **strong warning when it changes**. Users can compare [[GLOSSARY#Safety Number|Safety Numbers]] in person or by QR, as in Signal.
- **F4: [[GLOSSARY#Key Transparency|Key Transparency]].** An auditable log makes it detectable when the server serves different keys to different people.

## Alternatives considered
- **Mandatory verification before any conversation.** Rejected because it kills usability in Communities.
