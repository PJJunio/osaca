---
title: "ADR-0017: Abuse prevention without IP addresses"
status: accepted
date: 2026-11-17
tags:
  - adr
  - osaca
  - privacy
  - abuse
decisions: [Q16]
phase: F0
---

# ADR-0017: Abuse prevention without IP addresses

## Context
[[0009-metadata-minimisation-and-anonymous-accounts]] stores no IP addresses and leaves open how routes without a session (sign-up, sign-in, account recovery, instant accounts, public invite reads) resist abuse once per-IP limits go. On `.onion` Instances and behind a VPN the address identifies no one anyway, so a per-IP limit only gives a false sense of protection.

## Decision
Make abuse cost work, and limit by what is attacked instead of where the request comes from.

- **Proof-of-work on the routes without a session that create or open an Account.**
  - Sign-up (including instant accounts and the website handoff), sign-in and account recovery need a solved ALTCHA challenge. A challenge works once: its signature is claimed in the KV store with a TTL, and nothing about the client is kept.
  - The cost doubles with the pressure on the whole Instance: solved challenges over the last minute for that action, counted across every client, plus the instant accounts made in the past hour.
  - Only solved challenges count, so raising the cost for everyone costs the attacker proof-of-work too. The escalation is capped.
  - A token is checked against the cost at the moment it arrives, not the cost it was issued with. Challenges are free to collect, so honouring the issued cost would let an attacker stock up on cheap ones before an attack.
  - Routes that only continue a flow already gated this way (MFA, sign-in links, password reset links, handoff redemption) rely on their single-use codes and on the per-target limits below.
- **Limit by target.**
  - Failed sign-ins are counted per Account and raise the cost for that Account, with no hard lockout that would also lock its owner out.
  - Sign-ups through a registration URL or invite are limited per code, and public invite reads per code.
  - Requests with a session use per-Account or per-session buckets.
- **The registration mode is the main defence.** Sign-up by invite or with approval is the recommended setting. Open sign-up is an explicit Operator choice that rests on proof-of-work alone.
- **Nothing keys on an IP address.** Per-IP rate limit buckets, the authorized-IP flow and the remaining client address fields go.

## Rollout
Issue #65 delivers this in slices: the pressure-based proof-of-work first, then the per-target limits, then the removal of the per-IP buckets and the remaining client address fields, then the Operator documentation for the registration modes. Until the last slices land, the code still has per-IP limits that this decision removes.

## Consequences
- Proof-of-work costs battery and CPU on phones, so the cost only rises under pressure.
- An attacker with a lot of compute can pay the cost. Invite or approval sign-up covers that case, not proof-of-work alone.
- A distributed attack on open sign-up is harder to contain than with per-IP limits. That is the price [[0009-metadata-minimisation-and-anonymous-accounts]] accepts.
- Global pressure also raises the cost for legitimate people during an attack, within the cap, and a token solved just before the cost rose has to be solved again.
