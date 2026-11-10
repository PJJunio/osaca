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
| A malicious or compromised Operator who changes server code or logs everything | Full, as long as your client does not come from that Operator |
| Seizure or subpoena of the server's disk or database | Full |
| A network observer such as an ISP or public Wi-Fi | Partial, through planned Tor and SOCKS proxy support |
| A global passive adversary correlating traffic across the network | No protection |

"Full" describes the goal for message content, not metadata. See [Limitations](#limitations).

## What is implemented today

Delivery happens in phases, and only part of the design is built.

| Area | Status |
| --- | --- |
| Private Conversation messages | End-to-end encrypted with MLS through OpenMLS. Messages, edits, reactions, deletes and attachments are encrypted on Members' Devices. |
| Calls in Private Conversations | **Not end-to-end encrypted against the Operator yet.** The server hands out the call key. |
| Identity verification | Members can compare safety numbers. Identity keys are trusted on first use, and the client warns when one changes. |
| Push notifications | Wake-up signals only. They carry no message content. |
| Message search and export in Private Conversations | Not available yet. The server cannot search encrypted content, and client-side search is still to come. |
| Channels in a Community | **Channels in a Community are not end-to-end encrypted yet.** The Operator can read them today, and server-side message search still covers them. End-to-end encryption for Communities and their voice channels is the next phase. |
| Multiple Devices per Account | Not available yet. |
| Tor and SOCKS proxy support | Not available yet. |
| Security property tests | Partial. |
| Protocol specification | Not started. |

## What the Operator can still see

End-to-end encryption hides message content, not every fact about it. Today the Operator can still see:

- which Accounts take part in each Private Conversation and each Community;
- when messages are sent, and the size of messages and attachments;
- profiles, such as usernames, display names and avatars, which are stored in plaintext;
- the content of a message that a Member reports, because reporting sends it to the Operator;
- IP addresses at connection time, which are also used for rate limiting;
- everything in Channels in a Community, and the keys for calls, until those are encrypted.

Accounts are not tied to an email address, phone number or date of birth.

## Limitations

- **Metadata.** Who talks to whom, when and in which Community is minimised but not hidden. Techniques such as sealed sender and hidden membership are deferred.
- **Global observers.** OSACA provides no protection against an adversary who watches traffic across large parts of the network and correlates it.
- **Your Device.** End-to-end encryption does not help if a Member's Device is compromised, or if someone else in the conversation shares its content.
- **The client you run.** A malicious Operator who serves you a modified client can defeat the encryption. Get the client from a source you trust rather than from the Instance you connect to.
- **No audit yet.** The cryptography uses audited libraries rather than hand-rolled code, but OSACA itself has not been audited.
