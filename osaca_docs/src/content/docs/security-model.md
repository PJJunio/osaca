---
# SPDX-License-Identifier: AGPL-3.0-or-later
title: Security model
description: What OSACA protects against, what it does not, and how far the implementation has got.
---

:::caution[Experimental, unaudited]
OSACA is **experimental, unaudited** software. No external security audit has been done yet. Don't rely on it where a failure would put someone at risk.
:::

OSACA is built for an **untrusted Operator**. The person or organisation running an Instance should not be able to read what Members write, even if they change the server code. This page describes that goal, how much of it is implemented today, and the limits that apply even when it is complete.

## Who OSACA protects against

The design target is the following threat model.

| Adversary | Protection by design |
| --- | --- |
| A curious Operator reading the database | Full |
| A malicious or compromised Operator who changes server code or logs everything | Full |
| Seizure or subpoena of the server's disk or database | Full |
| A network observer such as an ISP or public Wi-Fi | Partial, only when the client is routed through Tor or a SOCKS proxy |
| A global passive adversary correlating traffic across the network | No protection |

"Full" describes the goal for message content, not metadata. See [Limitations](#limitations).

## What is implemented today

Delivery happens in phases, and only part of the design is built.

| Area | Status |
| --- | --- |
| Private Conversations (DMs and group DMs) | End-to-end encrypted with MLS through OpenMLS. Messages, edits, reactions, deletes and attachments are encrypted on members' devices. |
| Identity verification | Members can compare safety numbers. Identity keys are trusted on first use, and the client warns when one changes. |
| Push notifications | Push notifications are wake-up signals only and carry no message content. |
| Server-side content processing | Removed. The server does not scan, unfurl or transform message content. |
| Community Channels | **Community Channels are not end-to-end encrypted yet.** The Operator can read them today. End-to-end encryption for Communities and voice is the next phase. |
| Multiple devices per Account | Not available yet. |
| Security property tests and a protocol specification | In progress. |

## What the Operator can still see

End-to-end encryption hides message content, not every fact about it. With Private Conversations today, the Operator can still see:

- which Accounts take part in a Private Conversation, and when messages are sent;
- message sizes and timing;
- IP addresses at connection time, unless you connect through Tor or a proxy;
- everything in Community Channels, until they are encrypted.

Accounts are not tied to an email address, phone number or date of birth.

## Limitations

- **Metadata.** Who talks to whom, when and in which Community is minimised but not hidden. Techniques such as sealed sender and hidden membership are deferred.
- **Global observers.** OSACA provides no protection against an adversary who watches traffic across large parts of the network and correlates it.
- **Your device.** End-to-end encryption does not help if a member's device is compromised, or if someone else in the conversation shares its content.
- **The client you run.** A malicious Operator who serves you a modified client can defeat the encryption. Get the client from a source you trust rather than from the Instance you connect to.
- **No audit yet.** The cryptography uses audited libraries rather than hand-rolled code, but OSACA itself has not been audited.
