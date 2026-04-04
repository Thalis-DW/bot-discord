# Bot Discord

Bot de Discord com suporte a MongoDB para logs, rodando via Docker.

---

## Pré-requisitos

- [Docker](https://www.docker.com/) instalado
- [Docker Compose](https://docs.docker.com/compose/) instalado
- Token do bot do Discord (obtido no [Discord Developer Portal](https://discord.com/developers/applications))

---

## Configuração

1. Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env
```

2. Preencha o `.env` com seu token:

```env
DISCORD_TOKEN=seu_token_aqui
```

> O `MONGODB_URI` e `NODE_ENV` são preenchidos automaticamente pelo docker-compose em produção. Não é necessário alterar.

---

## Rodando em produção

As instâncias reiniciam automaticamente se caírem (`restart: always`).

```bash
# Subir tudo em background
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f

# Ver logs só do bot
docker-compose logs -f bot

# Parar tudo
docker-compose down
```

---

## Rodando em desenvolvimento (com Docker)

Sem restart automático, e com a porta do MongoDB exposta para acesso local (ex: MongoDB Compass).

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Rodando localmente (sem Docker)

Útil para desenvolvimento rápido com hot-reload.

1. Instale as dependências:

```bash
npm install
```

2. No `.env`, configure o MongoDB local:

```env
MONGODB_URI=mongodb://localhost:27017/botdiscord
```

3. Rode em modo desenvolvimento:

```bash
npm run dev
```

---

## Estrutura do projeto

```
bot-discord/
├── src/
│   ├── index.ts        # Ponto de entrada do bot
│   ├── database.ts     # Conexão com MongoDB
│   └── logger.ts       # Logger com persistência no MongoDB
├── Dockerfile
├── docker-compose.yml          # Produção (restart automático)
├── docker-compose.dev.yml      # Override para desenvolvimento
├── .env                        # Variáveis reais (não commitar)
├── .env.example                # Template das variáveis
└── .dockerignore
```

---

## Logs salvos no MongoDB

Os logs do bot são salvos na collection `logs` do banco `botdiscord`.

Para visualizar via linha de comando:

```bash
# Acessar o shell do MongoDB dentro do container
docker exec -it bot-mongodb mongosh botdiscord

# Dentro do mongosh:
db.logs.find().sort({ createdAt: -1 }).limit(20).pretty()
```

---

## Comandos úteis

```bash
# Reconstruir a imagem do bot após mudanças no código
docker-compose up -d --build bot

# Remover containers e volumes (apaga dados do MongoDB)
docker-compose down -v

# Ver status dos containers
docker-compose ps
```
