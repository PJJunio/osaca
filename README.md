<p align="center">
  <img src="./visual-identity/github-banner.jpg" alt="OSACA — Comunidade, sem vigilância." width="100%" />
</p>

<h1 align="center">OSACA</h1>

<p align="center">
  <b>Comunidade, sem vigilância.</b><br />
  <i>Open Source Anonymous Community App</i>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPLv3-102B42?style=flat-square" alt="AGPLv3 License" /></a>
  <img src="https://img.shields.io/badge/Status-pre--alpha-E84B35?style=flat-square" alt="Status: pre-alpha" />
  <img src="https://img.shields.io/badge/Security-unaudited-687783?style=flat-square" alt="Security: unaudited" />
  <img src="https://img.shields.io/badge/Price-free%20forever-102B42?style=flat-square" alt="Free forever" />
  <img src="https://img.shields.io/badge/E2EE-MLS%20(RFC%209420)-E84B35?style=flat-square" alt="MLS E2EE" />
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#português">Português</a>
</p>

---

## English

OSACA is a free and open-source, self-hosted community chat and voice app in the style of Discord, built so that **the person running the server cannot read your messages or find out who you are**. Tagline: *"Comunidade, sem vigilância."*

It is a hard fork of [Fluxer](https://github.com/fluxerapp/fluxer). Fluxer is a great self-hosted chat app, but it has no end-to-end encryption, so an instance operator can see every message, attachment, IP address and DM. OSACA keeps the community product and puts user anonymity first.

> [!WARNING]
> **OSACA is pre-alpha and unaudited.** Phase F1 (E2EE private messaging) and the visual identity are implemented, but the cryptographic implementation has not undergone a formal third-party audit yet. Do not use it in life-critical threat models.

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
| :--- | :--- | :--- |
| **F0** | "Fluxer without surveillance": rename; remove billing, GIFs, GeoIP, email/IP logging; operational admin panel; Postgres only | 🟢 Completed |
| **VIR** | Visual Identity Revamp: official OSACA palette, local Montserrat & Inter fonts, hybrid layout, anonymous identicons, docs & brand assets | 🟢 Completed |
| **F1** | E2EE Private Conversations (MLS RFC 9420), encrypted attachments, local search, TOFU safety numbers | 🟢 Completed |
| **F2** | E2EE communities, signed membership and roles, E2EE voice | 🟡 Next / Planned |
| **F3** | Multi-device with QR linking, key backup | ⚪ Planned |
| **F4** | Shared history, encrypted profiles, key transparency, mobile | ⚪ Later |

Full analysis: **[Technical Survey](docs/osaca-technical-survey.md)**.

### Documentation

The project docs in [`docs/`](docs/index.md) are written as an [Obsidian](https://obsidian.md) vault. Open the repository root as a vault to follow the links.

- [Technical Survey](docs/osaca-technical-survey.md): the Fluxer baseline, the gap analysis, every decision and the phases.
- [Architecture Decision Records](docs/adr/).
- [Glossary](GLOSSARY.md).
- [Docs rewrite plan](docs/fluxer-docs-rewrite-plan.md): how the inherited `osaca_docs/` site becomes OSACA's.

### Visual Identity

OSACA uses a distinct, privacy-preserving visual identity:

| Color | Hex | Role |
| --- | --- | --- |
| **Azul-marinho** | `#102B42` | Primary brand identity & navigation sidebar |
| **Vermelho-terra** | `#E84B35` | Action highlights, CTAs & accent buttons |
| **Marfim** | `#F3F1EB` | Light channel sidebar & soft canvas background |
| **Cinza ardósia** | `#687783` | Secondary text, subtle borders & metadata |
| **Branco** | `#FFFFFF` | Message feed & surface canvas |

- **Typography:** Montserrat (titles, headers and brand wordmark) & Inter (interface, chat messages, menus and components).
- **Privacy Avatars:** Deterministic geometric SVG identicons derived from account ID hashes with zero tracking, external CDN calls, or PII.

### Repository layout

Everything was renamed from `fluxer_*` to `osaca_*` in one mechanical commit ([ADR-0001](docs/adr/0001-hard-fork-as-osaca.md)). Domains that pointed to Fluxer's servers now use the reserved placeholder `osaca.example`, which never resolves.

| Path | Language | Role |
| --- | --- | --- |
| `osaca_app` | TypeScript, React | Client UI (web and desktop) |
| `osaca_desktop` | Electron | Desktop client (reference client) |
| `osaca_api` | TypeScript, Hono | REST API and worker |
| `osaca_gateway` | Erlang/OTP | WebSocket gateway, presence, voice grants |
| `osaca_media_proxy` | Rust | Uploads and media |
| `osaca_push` | Rust | Push delivery |
| `osaca_admin` | Rust | Operator admin panel |
| `osaca_svc`, `osaca_messages`, `osaca_users`, … | Rust | NATS RPC services |
| `osaca_rexctl` | Go | Self-host installer and CLI |
| `osaca_docs` | Astro | Inherited docs site (to be rewritten) |
| `osaca_landing` | Astro | Static institutional landing page |
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

OSACA is based on [Fluxer](https://github.com/fluxerapp/fluxer) by the Fluxer contributors, also AGPL-3.0-or-later. See [NOTICE](./NOTICE). Inherited Fluxer artwork in `osaca_static/` and elsewhere is licensed under [CC BY-SA 4.0](./osaca_static/LICENSE) and will be replaced. The Fluxer name and logo are not part of OSACA's identity, and OSACA is not affiliated with or endorsed by Fluxer.

---

## Português

O OSACA é um app de comunidades com chat e voz, no estilo Discord, **gratuito, open source e self-hosted**. Ele foi pensado para que **quem roda o servidor não consiga ler suas mensagens nem descobrir quem você é**.

O projeto é um fork definitivo do [Fluxer](https://github.com/fluxerapp/fluxer). O Fluxer é um ótimo chat self-hosted, mas não tem criptografia de ponta a ponta: o operador da instância vê todas as mensagens, anexos, IPs e DMs. O OSACA mantém o produto de comunidades e coloca o anonimato do usuário em primeiro lugar.

> [!WARNING]
> **O OSACA está em pré-alfa e não foi auditado.** A Fase F1 (mensagens privadas com E2EE) e a identidade visual estão implementadas, mas a implementação criptográfica ainda não passou por auditoria externa independente. Não use o OSACA para proteger vidas ou em cenários de alto risco.

### Objetivos

- 🔒 **Criptografia de ponta a ponta** com MLS (RFC 9420) via OpenMLS, para mensagens, anexos e chamadas. O servidor só guarda dados cifrados.
- 🕶️ **Contas anônimas**: só username. Sem e-mail, telefone ou data de nascimento.
- 🧹 **Mínimo de metadados**: o servidor não guarda IP, user agent nem localização. Retenção curta e suporte a `.onion`.
- 🛡️ **Servidor não confiável**: membros e cargos são assinados pelos donos das comunidades, então o operador não consegue se colocar numa conversa sem ser percebido.
- 🏠 **Self-hosted** numa única VPS.
- 💸 **100% gratuito**: sem plano premium, cobrança, anúncios ou rastreamento. Licença AGPL-3.0.

**Modelo de ameaça:** o OSACA protege contra um operador curioso ou malicioso e contra a apreensão dos dados do servidor. Contra quem observa a rede, a proteção é parcial (use Tor). Contra um adversário global, não há proteção.

### Roadmap

- **F0:** "Fluxer sem vigilância". Rebrand; remoção de cobrança, GIFs, GeoIP, e-mail e logs de IP; painel admin operacional; Postgres. — 🟢 **Concluído**
- **VIR:** Identidade Visual Oficial. Paleta OSACA, fontes locais Montserrat e Inter, layout híbrido, identicons determinísticos e documentação. — 🟢 **Concluído**
- **F1:** DMs e grupos de DM com E2EE (MLS RFC 9420), anexos criptografados, busca local cifrada e números de segurança (TOFU). — 🟢 **Concluído**
- **F2:** Comunidades com E2EE, membros e cargos assinados e voz com E2EE. — 🟡 **Próximo / Planejado**
- **F3:** Vários dispositivos por conta com QR code e backup de chaves. — ⚪ **Planejado**
- **F4:** Histórico compartilhado, perfis criptografados, Key Transparency e mobile. — ⚪ **Futuro**

A análise completa está no **[Levantamento Técnico](docs/osaca-technical-survey.md)**, em inglês. A documentação técnica fica em inglês para atrair contribuidores de qualquer lugar.

### Identidade Visual

O OSACA possui uma identidade visual focada em discrição, clareza e privacidade:

| Cor | Hex | Aplicação |
| --- | --- | --- |
| **Azul-marinho** | `#102B42` | Identidade principal & barra lateral de navegação |
| **Vermelho-terra** | `#E84B35` | Destaques, ações & botões principais |
| **Marfim** | `#F3F1EB` | Fundos claros & lista de canais |
| **Cinza ardósia** | `#687783` | Textos secundários, bordas discretas & metadados |
| **Branco** | `#FFFFFF` | Superfície de chat & leitura de mensagens |

- **Tipografia:** Montserrat (títulos e logotipo) e Inter (interface, mensagens e menus).
- **Avatares Anônimos:** Identicons geométricos gerados 100% no cliente a partir do hash do ID da conta, sem dependência de dados pessoais ou serviços externos.

### Licença

O código usa a licença [AGPL-3.0-or-later](./LICENSE). O OSACA é baseado no [Fluxer](https://github.com/fluxerapp/fluxer) e não tem afiliação com ele. Veja o [NOTICE](./NOTICE).
