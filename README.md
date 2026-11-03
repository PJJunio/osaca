<h1 align="center">OSACA</h1>

<p align="center"><b>Open Source Anonymous Community App</b></p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPLv3-purple" alt="AGPLv3 License" /></a>
  <img src="https://img.shields.io/badge/Status-pre--alpha-red" alt="Status: pre-alpha" />
  <img src="https://img.shields.io/badge/Security-unaudited-orange" alt="Security: unaudited" />
  <img src="https://img.shields.io/badge/Price-free%20forever-brightgreen" alt="Free forever" />
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#português">Português</a>
</p>

---

## English

OSACA is a free and open-source, self-hosted community chat and voice app in the style of Discord, built so that **the person running the server cannot read your messages or find out who you are**.

It is a hard fork of [Fluxer](https://github.com/fluxerapp/fluxer). Fluxer is a great self-hosted chat app, but it has no end-to-end encryption, so an instance operator can see every message, attachment, IP address and DM. OSACA keeps the community product and puts user anonymity first.

> [!WARNING]
> **OSACA is pre-alpha and unaudited.** Today the code is still Fluxer's, plus a written plan. **None of the guarantees below are implemented yet.** Do not use it to protect anyone.

### Goals

| | What it means |
| --- | --- |
| 🔒 **End-to-end encryption** | Messages, attachments and calls are encrypted with [MLS (RFC 9420)](https://www.rfc-editor.org/rfc/rfc9420), through OpenMLS. The server only stores ciphertext. |
| 🕶️ **Anonymous accounts** | Username only. No email, no phone number, no date of birth. |
| 🧹 **Minimal metadata** | No IP addresses, user agents or locations stored. Short retention. `.onion` support. |
| 🛡️ **Untrusted server** | Group membership and roles are signed by community owners, so an operator cannot quietly add themselves to a conversation. |
| 🏠 **Self-hosted** | Runs on a single VPS: Postgres, Valkey, NATS, SeaweedFS and LiveKit. |
| 💸 **100% free** | No premium tier, no billing, no ads, no tracking. AGPL-3.0. |

**Threat model in one line:** OSACA protects you from a curious or malicious server operator and from seizure of the server's data. It partially protects you from network observers (use Tor). It does not protect you from a global adversary. Details: [ADR-0002](docs/adr/0002-threat-model.md).

### Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| **F0** | "Fluxer without surveillance": rename; remove billing, GIFs, GeoIP, email and IP logging; operational-only admin panel; Postgres only | 🟡 Planned |
| **F1** | E2EE DMs and group DMs, encrypted attachments, local search, safety numbers | ⚪ Planned |
| **F2** | E2EE communities, signed membership and roles, E2EE voice | ⚪ Planned |
| **F3** | Multi-device with QR linking, key backup | ⚪ Planned |
| **F4** | Shared history, encrypted profiles, key transparency, mobile | ⚪ Later |

Full analysis: **[Technical Survey](docs/osaca-technical-survey.md)**.

### Documentation

The project docs in [`docs/`](docs/index.md) are written as an [Obsidian](https://obsidian.md) vault. Open the repository root as a vault to follow the links.

- [Technical Survey](docs/osaca-technical-survey.md): the Fluxer baseline, the gap analysis, every decision and the phases.
- [Architecture Decision Records](docs/adr/).
- [Glossary](GLOSSARY.md).
- [Docs rewrite plan](docs/fluxer-docs-rewrite-plan.md): how the inherited `fluxer_docs/` site becomes OSACA's.

### Repository layout

Directories still carry the `fluxer_` prefix until the rename in F0 ([ADR-0001](docs/adr/0001-hard-fork-as-osaca.md)).

| Path | Language | Role |
| --- | --- | --- |
| `fluxer_app` | TypeScript, React | Client UI (web and desktop) |
| `fluxer_desktop` | Electron | Desktop client (reference client) |
| `fluxer_api` | TypeScript, Hono | REST API and worker |
| `fluxer_gateway` | Erlang/OTP | WebSocket gateway, presence, voice grants |
| `fluxer_media_proxy` | Rust | Uploads and media |
| `fluxer_push` | Rust | Push delivery |
| `fluxer_admin` | Rust | Operator admin panel |
| `fluxer_svc`, `fluxer_messages`, `fluxer_users`, … | Rust | NATS RPC services |
| `fluxer_rexctl` | Go | Self-host installer and CLI |
| `fluxer_docs` | Astro | Inherited docs site (to be rewritten) |
| `packages/*` | TS, Rust | Shared libraries |
| `deploy/`, `config/` | | Helm, Compose and environment |

### Development

The inherited Fluxer tooling still works. You need Rust, Node with pnpm 11 and Docker.

```sh
pnpm install
pnpm dev:bootstrap   # first run
pnpm dev:infra:start # Postgres, Valkey, NATS, ...
pnpm dev             # API, gateway, services and app
```

Other useful commands are `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm docs:dev`. A dev container lives in `.devcontainer/`.

### Contributing

- Code, commits, technical docs and ADRs are in **English**.
- Every significant decision gets an ADR in `docs/adr/`.
- Use the terms defined in the [Glossary](GLOSSARY.md).
- **No hand-rolled cryptography.** Use audited libraries.
- **Delete before building.** Code that does not serve OSACA is removed, not adapted.

### License and credits

The source is licensed under [AGPL-3.0-or-later](./LICENSE).

OSACA is based on [Fluxer](https://github.com/fluxerapp/fluxer) by the Fluxer contributors, also AGPL-3.0-or-later. See [NOTICE](./NOTICE). Inherited Fluxer artwork in `fluxer_static/` is licensed under [CC BY-SA 4.0](./fluxer_static/LICENSE) and will be replaced. The Fluxer name and logo are not part of OSACA's identity, and OSACA is not affiliated with or endorsed by Fluxer.

---

## Português

O OSACA é um app de comunidades com chat e voz, no estilo Discord, **gratuito, open source e self-hosted**. Ele foi pensado para que **quem roda o servidor não consiga ler suas mensagens nem descobrir quem você é**.

O projeto é um fork definitivo do [Fluxer](https://github.com/fluxerapp/fluxer). O Fluxer é um ótimo chat self-hosted, mas não tem criptografia de ponta a ponta: o operador da instância vê todas as mensagens, anexos, IPs e DMs. O OSACA mantém o produto de comunidades e coloca o anonimato do usuário em primeiro lugar.

> [!WARNING]
> **O OSACA está em pré-alfa e não foi auditado.** Hoje o código ainda é o do Fluxer, junto com um plano escrito. **Nenhuma das garantias abaixo está implementada ainda.** Não use o OSACA para proteger ninguém.

### Objetivos

- 🔒 **Criptografia de ponta a ponta** com MLS (RFC 9420) via OpenMLS, para mensagens, anexos e chamadas. O servidor só guarda dados cifrados.
- 🕶️ **Contas anônimas**: só username. Sem e-mail, telefone ou data de nascimento.
- 🧹 **Mínimo de metadados**: o servidor não guarda IP, user agent nem localização. Retenção curta e suporte a `.onion`.
- 🛡️ **Servidor não confiável**: membros e cargos são assinados pelos donos das comunidades, então o operador não consegue se colocar numa conversa sem ser percebido.
- 🏠 **Self-hosted** numa única VPS.
- 💸 **100% gratuito**: sem plano premium, cobrança, anúncios ou rastreamento. Licença AGPL-3.0.

**Modelo de ameaça:** o OSACA protege contra um operador curioso ou malicioso e contra a apreensão dos dados do servidor. Contra quem observa a rede, a proteção é parcial (use Tor). Contra um adversário global, não há proteção.

### Roadmap

- **F0:** "Fluxer sem vigilância". Rebrand; remoção de cobrança, GIFs, GeoIP, e-mail e logs de IP; painel admin só operacional; só Postgres.
- **F1:** DMs e grupos de DM com E2EE, anexos criptografados, busca local e números de segurança.
- **F2:** comunidades com E2EE, membros e cargos assinados e voz com E2EE.
- **F3:** vários dispositivos por conta com QR code e backup de chaves.
- **F4:** histórico compartilhado, perfis criptografados, Key Transparency e mobile.

A análise completa está no **[Levantamento Técnico](docs/osaca-technical-survey.md)**, em inglês. A documentação técnica fica em inglês para atrair contribuidores de qualquer lugar.

### Licença

O código usa a licença [AGPL-3.0-or-later](./LICENSE). O OSACA é baseado no [Fluxer](https://github.com/fluxerapp/fluxer) e não tem afiliação com ele. Veja o [NOTICE](./NOTICE).
