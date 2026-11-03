---
title: "ADR-0002: Threat model"
status: accepted
date: 2026-11-03
tags:
  - adr
  - osaca
  - security
decisions: [Q1, Q2]
phase: F0
---

# ADR-0002: Threat model

## Context
OSACA exists so that the person running the server cannot see users' information. Every other decision depends on who the adversary is.

## Decision

| Adversary | Protection |
| --- | --- |
| (a) Curious [[GLOSSARY#Operator\|Operator]] reading the database | **Full** |
| (b) Malicious or compromised Operator: modifies server code, serves a tampered client, logs everything | **Full** |
| (c) Seizure or subpoena of the disk or database | **Full** |
| (d) Network observer (ISP, public Wi-Fi) | **Partial**, through Tor/`.onion` and SOCKS proxy support |
| (e) Global passive adversary correlating traffic | **None**, documented as out of scope |

Anonymity has three layers:
1. **Content.** E2EE for messages, attachments and calls. Mandatory from v1.
2. **Identity.** Accounts are not linkable to a real person: no email, phone or date of birth, and no IP stored. Mandatory from v1.
3. **Metadata.** Who talks to whom, when, and in which Community. Minimised progressively: minimal logs and retention in v1, advanced hiding techniques later.

> [!important] Design rules that follow
> - The server is not trusted to distribute keys ([[0005-key-verification]]) or to decide group membership ([[0007-signed-membership-and-roles]]).
> - The server is not the source of client code ([[0011-client-platforms]]).
> - Data that is never stored cannot be seized ([[0009-metadata-minimisation-and-anonymous-accounts]]).

## Consequences
Server-side features that read content are removed ([[0008-no-server-side-content-processing]]). Full metadata privacy, such as sealed sender and hidden membership, is research-grade work for a Discord-style product and is deliberately deferred.
