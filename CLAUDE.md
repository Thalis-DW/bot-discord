# CLAUDE.md — Bot Discord (Police Rank System)

## Visão Geral

Bot Discord para gestão de fichas funcionais (cargos policiais) em servidor. Permite que usuários solicitem graduações via fluxo interativo (botão → modal → select menu) com aprovação/rejeição por staff.

## Stack

| Item | Detalhe |
|------|---------|
| Linguagem | TypeScript 6.x (CommonJS) |
| Runtime | Node.js 20 |
| Framework Discord | discord.js 14.x |
| Banco de Dados | MongoDB 7 via Mongoose 8.x |
| Deploy | Docker Compose (prod + dev) |
| Dev | ts-node-dev (hot reload) |

## Estrutura de Arquivos

```
src/
├── index.ts              # Entry point: conecta DB, registra eventos, login
├── database.ts           # Conexão MongoDB (non-blocking)
├── logger.ts             # Logger duplo: console + MongoDB (schema Log)
├── deploy-commands.ts    # Registra slash commands via REST API
├── commands/
│   └── solicitar-funcional.ts  # Toda a lógica do fluxo de ficha funcional
└── config/
    └── ranks.ts          # Array RANKS com configuração de graduações
```

## Variáveis de Ambiente (.env)

```env
DISCORD_TOKEN=        # Token do bot
CLIENT_ID=            # Application ID (Discord Developer Portal)
GUILD_ID=             # ID do servidor
MONGODB_URI=          # mongodb://localhost:27017/botdiscord
NODE_ENV=             # development | production
AUTHORIZED_USER_ID=   # User ID que pode publicar /solicitar-funcional
```

Em Docker produção, `MONGODB_URI` e `NODE_ENV` são sobrescritos pelo `docker-compose.yml`.

## Comandos npm

```bash
npm run dev      # ts-node-dev (hot reload, desenvolvimento local)
npm run build    # tsc → dist/
npm run start    # node dist/index.js
npm run deploy   # Registra slash commands no Discord
```

## Docker

```bash
# Produção (auto-restart)
docker-compose up -d

# Dev com Docker (sem auto-restart, porta 27017 exposta)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Logs em tempo real
docker-compose logs -f
```

## Padrão de Comandos Slash

- Registrados em `deploy-commands.ts` com `SlashCommandBuilder`
- Roteados em `index.ts` dentro do evento `interactionCreate`
- Lógica implementada em `src/commands/<nome-do-comando>.ts`
- Sempre exportar uma função padrão que recebe `(interaction, client)`

## Comandos Existentes

| Comando | Arquivo | Restrição |
|---------|---------|-----------|
| `/teste` | `index.ts` (inline) | Nenhuma |
| `/solicitar-funcional` | `commands/solicitar-funcional.ts` | `AUTHORIZED_USER_ID` |
| `/ticket` | `commands/ticket.ts` | `AUTHORIZED_USER_ID` |

## Padrão de Interações (index.ts)

Todos os tipos de interação são tratados no evento `interactionCreate` com verificação de tipo:

```typescript
if (interaction.isChatInputCommand()) { ... }
if (interaction.isModalSubmit()) { ... }
if (interaction.isStringSelectMenu()) { ... }
if (interaction.isButton()) { ... }
```

Sempre envolver em try-catch com `logger.error()` e resposta de fallback ao usuário.

## Fluxo: ticket (src/commands/ticket.ts)

```
/ticket (AUTHORIZED_USER_ID)
  → publica embed com StringSelectMenu [select_ticket_tipo]
     opções: alteracao-discord | alteracao-hierarquia | outros
  → usuário seleciona → modal [modal_ticket_resumo:{tipo}] (resumo 10–500 chars)
  → cria canal de texto na categoria "🎫┇TICKETS-P1"
     nome: {prefix}-{username-slug}  (ex: discord-joaosilva)
     permissões: copiadas da categoria + ViewChannel/Send para quem abriu
  → bot envia embed com resumo + 4 botões:
     [encerrar_ticket:{userId}]   → deleta canal em 5s, DM para quem abriu
     [add_membro_ticket]          → mostra UserSelectMenu [select_add_membro_ticket]
     [renomear_ticket]            → modal [modal_renomear_ticket]
     [notificar_membro:{userId}]  → DM para quem abriu avisando que está sendo chamado
```

**Prefixos de canal por tipo:**
- `alteracao-discord` → `discord`
- `alteracao-hierarquia` → `hierarquia`
- `outros` → `outros`

## Fluxo: solicitar-funcional

```
/solicitar-funcional (AUTHORIZED_USER_ID)
  → publica embed com botão [btn_abrir_funcional]
  → usuário clica → modal [modal_solicitar_funcional] (nome, rg)
  → dados salvos em Map<userId, {nome, rg}> (em memória, perdido ao reiniciar)
  → select menu [select_graduacao] com todas as graduações de RANKS
  → embed enviado para canal "✅・aprovar-funcional"
  → staff clica [aprovar:userId:rankValue] ou [recusar:userId]
  → aprovação: remove todos managed roles, adiciona role + additionalRoles,
               muda nick para "{nickPrefix} | {nome} - {rg}", envia DM
  → rejeição: atualiza embed, envia DM
  → tudo logado no MongoDB
```

## Configuração de Ranks (src/config/ranks.ts)

```typescript
interface Rank {
  label: string;       // Nome exibido
  value: string;       // Identificador único
  roleName: string;    // Nome EXATO do cargo no Discord
  additionalRoles: string[];  // Cargos extras concedidos
  nickPrefix: string;  // Prefixo do apelido
  emoji: string;       // Emoji de exibição
}

export const RANKS: Rank[] = [ ... ];
```

Para adicionar nova graduação: adicionar objeto ao array `RANKS` e rodar `npm run deploy` se necessário.

## Logger

```typescript
import { logger } from './logger';

logger.info('mensagem', { metadata: 'opcional' });
logger.warn('mensagem');
logger.error('mensagem', error);
```

Persiste no MongoDB (coleção `logs`) e no console. Funciona mesmo sem DB.

## Convenções de Código

- **camelCase** — variáveis, funções
- **UPPER_CASE** — constantes (`RANKS`, `AUTHORIZED_USER_ID`)
- **PascalCase** — interfaces e tipos (`Rank`, `ILog`, `PendingRequest`)
- Comentários de seção: `// ─── Step N. Descrição ──────────────`
- Sem `any` — tipar tudo com discord.js types
- Fallbacks silenciosos: `.catch(() => null)` para DMs e operações não críticas
- Banco de dados non-blocking: bot funciona mesmo sem MongoDB

## Customização de IDs de Interação

- Botões parametrizados: `aprovar:userId:rankValue`, `recusar:userId`
- Separador padrão: `:` (dois pontos)
- Parse: `interaction.customId.split(':')`

## Logs no MongoDB

```bash
docker exec -it bot-mongodb mongosh botdiscord
db.logs.find().sort({ createdAt: -1 }).limit(20).pretty()
```

## O que NÃO fazer

- Não usar `interaction.reply()` após já ter respondido — usar `followUp()` ou `editReply()`
- Não armazenar dados sensíveis em `pendingRequests` Map além do fluxo ativo (dados perdidos ao reiniciar)
- Não hardcodar nomes de canais — o canal de aprovação é buscado por nome `✅・aprovar-funcional`
- Não registrar comandos diretamente em `index.ts` — usar `deploy-commands.ts` separado
- Não commitar `.env`
