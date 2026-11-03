---
title: "ADR-0001: Hard fork of Fluxer as OSACA"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
decisions: [Q4, Q29, Q32]
phase: F0
---

# ADR-0001: Hard fork of Fluxer as OSACA

## Context
Fluxer has no encryption and is hard to contribute to upstream. E2EE changes the data model, the API and the client so deeply that tracking upstream would mean an endless merge conflict. The Fluxer name and marks are not licensed for reuse; the code is AGPL-3.0-or-later and the artwork is CC BY-SA 4.0.

## Decision
- OSACA is a **hard fork**. Upstream fixes are cherry-picked by hand when useful, and there is no attempt to stay mergeable.
- The license stays **AGPL-3.0-or-later**. Fluxer is credited in the README and NOTICE.
- One early **mechanical rename** commit changes `fluxer_*` to `osaca_*` across directories, crates, packages, strings and domains, before the codebases diverge.
- Fluxer artwork is replaced. Until then it is used under CC BY-SA 4.0 with attribution.
- **Code, commits, technical docs and ADRs are written in English.** The README is in English and Portuguese.

## Consequences
- Fluxer servers and clients are not compatible with OSACA.
- The rename touches almost every file once, so it has to land before any feature work to keep later diffs readable.

## Alternatives considered
- **A soft fork that tracks upstream.** Rejected because the E2EE rewrite makes it unworkable.
- **Renaming only the user-facing strings.** Rejected because it leaves permanent confusion inside the codebase.

See [[osaca-technical-survey]].
