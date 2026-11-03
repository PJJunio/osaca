---
title: OSACA Docs
aliases:
  - Home
  - OSACA Docs
tags:
  - osaca
  - moc
---

# OSACA Docs

The entry point for OSACA's project documentation. Open the repository root as an Obsidian vault and every `[[link]]` resolves.

> [!warning] Experimental, unaudited
> OSACA is in early development. Until an external security audit, do not rely on it for high-risk use.

## Start here
- [[osaca-technical-survey|Technical Survey]]: the Fluxer baseline, the gap analysis, the decisions and the roadmap.
- [[GLOSSARY|Glossary]]: shared vocabulary.
- [[fluxer-docs-rewrite-plan|Docs Rewrite Plan]]: how `osaca_docs/` becomes OSACA's docs.

## Architecture Decision Records

| ADR | Topic | Phase |
| --- | --- | --- |
| [[0001-hard-fork-as-osaca]] | Hard fork, rename, language | F0 |
| [[0002-threat-model]] | Threat model | F0 |
| [[0003-no-federation]] | No federation | F0 |
| [[0004-mls-with-openmls]] | MLS via OpenMLS, `osaca_crypto`, Delivery Service | F1 |
| [[0005-key-verification]] | Safety Numbers | F1 |
| [[0006-mls-group-topology]] | MLS group topology | F2 |
| [[0007-signed-membership-and-roles]] | Signed membership and roles | F2 |
| [[0008-no-server-side-content-processing]] | No server-side content processing | F1 |
| [[0009-metadata-minimisation-and-anonymous-accounts]] | Metadata minimisation, anonymous accounts | F0 |
| [[0010-operational-admin-panel]] | Operational-only admin panel | F0 |
| [[0011-client-platforms]] | Client platforms | F1 |
| [[0012-encrypted-history-on-server]] | Encrypted history | F1 |
| [[0013-multi-device]] | Multi-device | F3 |
| [[0014-voice-e2ee-from-mls]] | Voice E2EE | F2 |
| [[0015-postgres-only-and-fresh-install]] | Postgres only, fresh install | F0 |
| [[0016-phased-delivery-and-security-validation]] | Phases and security validation | F0 |

## Writing ADRs
- Copy an existing ADR and number it sequentially (`NNNN-kebab-title.md`).
- Fill in the frontmatter: `status`, `date`, `phase`, `decisions`.
- To change a decision, write a new ADR and set the old one's `status: superseded`. Never rewrite history.
