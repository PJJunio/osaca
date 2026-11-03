---
title: OSACA Glossary
aliases:
  - Glossary
tags:
  - osaca
  - domain
status: living
updated: 2026-11-03
---

# OSACA Glossary

The shared vocabulary for OSACA. Use these terms, exactly as written, in code, issues, docs and ADRs. Hub note: [[docs/index|OSACA Docs]].

> [!tip] Adding terms
> If a concept you need is missing, add it here before it spreads under several names. Mark rejected synonyms under **Avoid**.

## People and roles

**Operator**
The person or organisation running an [[#Instance]] on their own infrastructure (typically a VPS). Under the [[0002-threat-model|threat model]], the Operator is **untrusted**: they may be curious, malicious, or compromised.
_Avoid_: admin, server owner, host.

**Community Owner**
The [[#Member]] who created a [[#Community]]. Holds the root [[#Governance Key]] for that Community. Unrelated to the Operator.
_Avoid_: guild owner, server owner.

**Moderator**
A Member granted moderation rights in a Community by a [[#Signed Governance Event]]. Sees content because they are a Member, never because of a server privilege.

**Member**
An [[#Account]] that belongs to a Community or a [[#Private Conversation]] and holds a leaf in the relevant [[#MLS Group]] on each of its [[#Device|Devices]].

## Places

**Instance**
One self-hosted OSACA deployment (API, gateway, Delivery Service, storage). Instances are isolated; there is no federation ([[0003-no-federation]]).
_Avoid_: server (ambiguous with Community), node.

**Community**
A Discord-style space with channels, roles and members, hosted on an Instance.
_Avoid_: guild, server. (`guild` survives in inherited Fluxer code until renamed.)

**Channel**
A text or voice room inside a Community. A **Public Channel** is visible to `@everyone`; a **Private Channel** is restricted by roles.

**Private Conversation**
A DM or group DM outside any Community.
_Avoid_: private channel (that term belongs to Communities).

**Community Directory**
The opt-in, server-side, plaintext listing of Communities that want to be discoverable by name. The only place where server-side search remains.

## Identity

**Account**
A username-only identity on one Instance. No email, phone, date of birth or real-world identifier ([[0009-metadata-minimisation-and-anonymous-accounts]]).

**Device**
One installation of an OSACA client logged into an Account. Each Device is a separate leaf in every MLS Group the Account belongs to ([[0013-multi-device]]). Max 5 per Account.

**Identity Key**
The long-term signing key of an Account, from which Device credentials are certified.

**Safety Number**
A short, human-comparable fingerprint of two Accounts' Identity Keys, compared in person or by QR to detect key substitution ([[0005-key-verification]]).

**Recovery Kit**
The offline secret a user keeps to restore their Account and the encrypted backup of their keys. Inherited from Fluxer's username mode and extended for E2EE.

**Ghost Member**
A leaf added to an MLS Group without a valid [[#Signed Governance Event]], for example by a malicious Operator. Clients must detect and flag Ghost Members ([[0007-signed-membership-and-roles]]).
_Avoid_: phantom user, hidden member.

## Cryptography

**E2EE**
End-to-end encryption: only the Devices of the intended Members can read content. The Instance only ever sees ciphertext.

**MLS**
Messaging Layer Security (RFC 9420), the group key agreement protocol OSACA uses for all E2EE, through OpenMLS ([[0004-mls-with-openmls]]).

**MLS Group**
One MLS cryptographic group. Topology: one per Private Conversation, one per Community for its Public Channels, one per Private Channel ([[0006-mls-group-topology]]).

**Epoch**
One version of an MLS Group's key state. Every Commit advances the Epoch.

**Commit**
An MLS handshake message that changes group state (add/remove members, rotate keys). The [[#Delivery Service]] orders Commits per Group.

**KeyPackage**
A pre-published MLS bundle that lets others add a Device to a Group while it is offline.

**Governance Key**
A signing key held by the Community Owner (and delegated to Moderators) used to sign membership and role changes.

**Signed Governance Event**
A membership or role change signed by a Governance Key and verified by every client. The server relays it but cannot forge it.

**Delivery Service**
The new Rust service that stores KeyPackages, orders Commits and stores ciphertext. Never holds keys. Abbreviation: **DS**.

**Wake-up Push**
A push notification with no content and no sender, telling a client to fetch and decrypt locally ([[0008-no-server-side-content-processing]]).

**Message Franking**
A future mechanism that lets the Operator verify that a reported message was really sent, without seeing other content (Phase F4).

**Key Transparency**
A future append-only, auditable log of Identity Keys that makes per-user key substitution detectable (Phase F4).
