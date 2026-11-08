# Guia de Testes do OSACA (Fases F0 e F1)

Este documento descreve todo o roteiro de testes necessário para validar as entregas das Fases **F0 ("Fluxer without surveillance")** e **F1 ("End-to-End Encrypted Private Conversations")**, incluindo a execução de testes automatizados e o checklist de testes manuais/E2E em ambiente de homologação ou produção.

---

## 1. Visão Geral das Entregas das Fases F0 e F1

| Fase | Foco Principal | Status | ADRs Associados |
| :--- | :--- | :--- | :--- |
| **F0** | Hard-fork do Fluxer, remoção de telemetria, vigilância, rastreamento de IP/GeoIP, idade/DOB, pagamentos e simplificação operacional (Postgres-only). | **100% Concluído** | [ADR-0001](docs/adr/0001-hard-fork-as-osaca.md), [ADR-0009](docs/adr/0009-metadata-minimisation-and-anonymous-accounts.md), [ADR-0010](docs/adr/0010-operational-admin-panel.md), [ADR-0015](docs/adr/0015-postgres-only-and-fresh-install.md) |
| **F1** | Criptografia Fim-a-Fim (E2EE) em DMs e Group DMs baseada no protocolo MLS (Messaging Layer Security, RFC 9420), verificação de chaves TOFU / Safety Numbers, anexos cifrados no cliente, edições/reações cifradas, busca local e ausência total de processamento de texto no servidor. | **100% Concluído** (Issues F1-01 a F1-10 fechadas) | [ADR-0004](docs/adr/0004-mls-with-openmls.md), [ADR-0005](docs/adr/0005-key-verification.md), [ADR-0008](docs/adr/0008-no-server-side-content-processing.md), [ADR-0016](docs/adr/0016-phased-delivery-and-security-validation.md) |

---

## 2. Matriz de Testes Automatizados

### 2.1 Criptografia e Primitivas MLS (`@osaca/crypto`)
Diretório: `packages/osaca_crypto/src/__tests__/`

Para rodar todos os testes do pacote criptográfico:
```bash
corepack pnpm --filter @osaca/crypto test
```

- **`crypto.test.ts`**:
  - Geração de Identity Keys Ed25519 e sessões de dispositivo.
  - Geração e publicação de MLS KeyPackages.
  - Criação de grupos MLS bilaterais e multilaterais.
  - Criptografia e decriptografia de mensagens de aplicação MLS.
- **`attachment.test.ts`**:
  - Criptografia simétrica autenticada AES-256-GCM no cliente com chaves efêmeras aleatórias de 256 bits e nonces de 96 bits.
  - Verificação de integridade de hash SHA-256 antes da decriptação.
  - Rejeição de adulteração em bytes cifrados (`AttachmentDigestMismatchError`).
- **`tofu.test.ts`**:
  - Persistência Trust-On-First-Use (TOFU) da chave de identidade no primeiro contato.
  - Confirmação de contatos com mesma chave pública (`trusted`).
  - Detecção imediata de substituição de chave pública (`key_changed`), preservação da chave confiada anterior e exigência de reconhecimento explícito.
  - Invalidação automática do status de verificação prévio após mudança de chave.
- **`safety_number.test.ts`**:
  - Derivação determinística de Safety Numbers numéricos de 60 dígitos (12 blocos de 5 dígitos).
  - Garantia de simetria: `derive(Alice, Bob) === derive(Bob, Alice)`.
  - Geração de payload para escaneamento de QR Code.
- **`security_properties.test.ts` (Propriedades de Segurança Criptográfica)**:
  - **Integridade da Cifra**: Rejeição por bit flipping no início, meio e fim do ciphertext, truncamento e injeção de cabeçalhos adulterados.
  - **Exclusão de Não Membros**: Dispositivos sem sessão no grupo não conseguem descriptografar o payload da aplicação.
  - **Forward Secrecy**: Membros que ingressam em época posterior via Welcome não conseguem descriptografar mensagens de épocas passadas.
  - **Detecção de Troca de Chaves**: Invalidação imediata do status de verificação e alteração dos Safety Numbers.

### 2.2 API e Delivery Service (`osaca_api`)
Diretório: `osaca_api/src/api/mls/tests/`

Para rodar todos os testes de MLS e E2EE da API:
```bash
corepack pnpm --filter osaca_api test src/api/mls/tests/
```

- **`PrivateConversationsE2EE.test.ts`**:
  - Rejeição de envio de conteúdo plaintext em canais de DM e Group DM (`PLAINTEXT_PRIVATE_MESSAGING_DISABLED`).
  - Fluxo completo de troca de mensagens MLS criptografadas entre dois usuários.
  - Validação de que o banco de dados armazena apenas cifras opacas em base64.
- **`MlsDeliveryService.test.ts`**:
  - Publicação e consumo atômico de KeyPackages até a exaustão (`MLS_KEY_PACKAGE_EXHAUSTED`).
  - Criação e consulta de grupos MLS no Delivery Service.
  - Validação de expiração / TTL de mensagens autodestrutivas.
- **`EncryptedEditsReactionsDeletes.test.ts`**:
  - Edição de mensagens usando payloads cifrados MLS (`message_edit`).
  - Adição e remoção de reações com emojis criptografados (`reaction_add`, `reaction_remove`).
  - Exclusão de mensagens com tombstones cifrados no cliente e descarte de cifras no servidor.
  - Extração de menções exclusivamente no cliente (`extractClientMentions`).
- **`EncryptedAttachmentsE2EE.test.ts`**:
  - Upload de anexos criptografados pelo cliente com nomes e metadados opacos (`enc_*.bin`).
  - Metadados sensíveis (nome real do arquivo, MIME type, chave AES, nonce, hash) transmitidos unicamente dentro da mensagem MLS criptografada.
  - Pré-visualização de links sender-side sem scraping ou vazamento no servidor.
- **`TofuSafetyNumbersE2EE.test.ts`**:
  - Publicação de chaves públicas de identidade dos usuários na API.
  - Comparação de Safety Numbers entre clientes conectados.
- **`PhaseF1SecurityProperties.test.ts` (Testes Globais de Propriedades de Segurança)**:
  - **Ausência Absoluta de Plaintext (ADR-0008, ADR-0016)**:
    - Injeção de canaries para texto de mensagem, texto de edição, emoji de reação, nome de anexo e conteúdo de anexo.
    - Assertiva de que nenhum canary aparece em respostas HTTP, frames WebSocket de presença do Gateway, tabelas de mensagens ou blobs S3.
    - Decriptação bem-sucedida pelo destinatário legítimo.
  - **Monotonicidade de Épocas e Conflito de Commits (ADR-0004)**:
    - Dois commits concorrentes para a mesma época resultam em exatamente 1 sucesso (201) e 1 conflito rejeitado (409 Conflict com `APIErrorCodes.MLS_EPOCH_CONFLICT`).
    - Rejeição de commits obsoletos ou com pulo de época.

---

## 3. Checklist de Testes Manuais e Verificação em Produção (E2E)

### 3.1 Inicialização e Painel Operacional (F0)
- [ ] **Instalação da Instância**: Executar instalação via `rexctl`, Docker Compose ou Helm Chart conforme documentação.
- [ ] **Configuração Inicial do Admin**: Acessar o domínio configurado e autenticar utilizando o `OSACA_SETUP_TOKEN`.
- [ ] **Verificação de Telemetria e Zero-Tracking**:
  - Confirmar que tabelas de geolocalização (MaxMind GeoIP) não estão presentes nem ativas.
  - Confirmar que logs da aplicação e banco de dados não registram IPs de clientes nem User-Agents detalhados.
  - Confirmar ausência de integrações externas como Klipy GIFs ou relays centralizados de push.

### 3.2 Indicador de Versão Experimental (F1-10 / ADR-0016)
- [ ] **Configurações do Cliente**:
  - Abrir o diálogo de Configurações de Usuário (Desktop ou Web).
  - No rodapé do painel de navegação (ao lado das informações de versão do client), verificar a exibição da badge:
    `EXPERIMENTAL, UNAUDITED E2EE`.
  - Ao clicar para copiar as informações da versão, verificar se o texto exportado inclui:
    `E2EE: Experimental (unaudited, ADR-0016)`.
- [ ] **Aba de Privacidade e Segurança**:
  - Navegar até **Configurações > Privacidade e Segurança**.
  - No topo do painel, verificar o banner de aviso ([`WarningAlert`](osaca_app/src/features/ui/warning_alert/WarningAlert.tsx)) com o título *"Experimental, unaudited E2EE"* e o aviso de que o sistema não passou por auditoria externa de segurança e não deve ser usado para situações de risco de vida ou alto risco.

### 3.3 Fluxo de Mensagens Privadas Criptografadas (DM e Group DM)
- [ ] **Criação de Contas de Teste**: Criar duas contas (ex: Alice e Bob) na instância.
- [ ] **Início de DM**:
  - Alice adiciona Bob como amigo e abre uma conversa privada.
  - Confirmar que as chaves de identidade e sessões MLS locais são geradas automaticamente no cliente.
- [ ] **Envio de Mensagens de Texto**:
  - Alice envia mensagem para Bob.
  - Bob recebe a mensagem em tempo real via WebSocket.
  - Abrir o Developer Tools (Network) e inspecionar o payload da requisição `POST /channels/:id/messages`:
    - O campo `content` deve estar vazio (`""`).
    - O payload deve conter apenas `ciphertext` (base64 opaco) e `epoch`.
- [ ] **Edição de Mensagem**:
  - Alice edita uma mensagem previamente enviada.
  - A alteração reflete imediatamente na tela de Bob.
  - O tráfego de rede transmite apenas um payload MLS cifrado com a operação de edição.
- [ ] **Reações com Emojis**:
  - Bob adiciona uma reação à mensagem de Alice.
  - Alice visualiza a reação.
  - Bob remove a reação; a reação desaparece para ambos.
  - A operação trafega exclusivamente como mensagem de aplicação MLS criptografada.
- [ ] **Exclusão de Mensagem (Tombstones)**:
  - Alice exclui sua mensagem.
  - O conteúdo é substituído localmente por tombstone e a cifra é removida da API/banco.

### 3.4 Anexos Criptografados no Cliente (F1-07)
- [ ] **Upload de Arquivo (Imagem/Documento)**:
  - Alice anexa uma imagem ou documento confidencial e envia na DM.
  - No Network tab:
    - O upload para a URL pré-assinada utiliza um nome opaco (`enc_<uuid>.bin`) com Content-Type `application/octet-stream`.
    - O nome original do arquivo (ex: `relatorio.pdf`) **não** aparece na requisição de upload.
  - Bob recebe o anexo, o cliente descriptografa localmente a chave AES-256 e o arquivo é exibido ou baixado perfeitamente com o nome e tamanho originais.
- [ ] **Integridade do Anexo**:
  - Se o blob cifrado no storage sofrer qualquer modificação de bytes, o cliente recusa a decriptação e acusa falha de digest SHA-256.

### 3.5 Verificação de Identidade e Safety Numbers (F1-08)
- [ ] **Visualização de Safety Number**:
  - Na conversa entre Alice e Bob, abrir o painel de verificação de identidade.
  - Confirmar a exibição do código de 60 dígitos e do QR Code correspondente.
  - Confirmar que Alice e Bob visualizam exatamente a mesma sequência de dígitos.
- [ ] **Confirmação de Verificação**:
  - Alice marca o contato de Bob como "Verificado".
  - O indicador de segurança passa para o estado verificado.
- [ ] **Detecção de Troca de Chaves (TOFU Key Substitution)**:
  - Simular uma redefinição ou acesso em novo dispositivo por Bob sem sincronização.
  - Ao receber uma nova mensagem de Bob, Alice deve receber um alerta proeminente de que a chave de Bob foi alterada (*"Key change detected"*).
  - O status de verificação prévio de Bob é imediatamente revogado para não verificado.

### 3.6 Busca Local e Exportação de Dados Criptografados (F1-09)
- [ ] **Pesquisa Local no Cliente**:
  - Alice utiliza a barra de busca na DM.
  - O cliente pesquisa no banco de dados local IndexedDB/cache de mensagens descriptografadas.
  - Verificar no Network tab que **nenhuma requisição HTTP** é disparada ao servidor com o termo pesquisado.
- [ ] **Exportação de Dados**:
  - Em Configurações de Usuário > Privacidade > Exportação de Dados, solicitar exportação.
  - O cliente descriptografa e gera o pacote JSON com o histórico disponível no dispositivo.

---

## 4. Comandos de Validação Rápida via Terminal

Para rodar todas as verificações do ecossistema localmente antes de um deploy:

```bash
# 1. Testes unitários e de propriedades criptográficas
corepack pnpm --filter @osaca/crypto test

# 2. Testes de integração de API e propriedades de segurança MLS
corepack pnpm --filter osaca_api test src/api/mls/tests/

# 3. Verificação de linting e formatação
npx @biomejs/biome check
```
