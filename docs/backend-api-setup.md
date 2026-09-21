# Backend API Setup Guide

> **Bounty #20** — Docs: Backend API setup guide (Issue #31)

This guide walks you through setting up the Cocohub backend API for local development. The backend is a Node.js/TypeScript Express server backed by PostgreSQL and Redis.

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| **Node.js** | 18 LTS | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions |
| **npm** | 9+ | Bundled with Node 18 |
| **Docker** | 24+ | Required for the recommended database/Redis setup |
| **Docker Compose** | v2 (plugin) | `docker compose` (no hyphen) |
| **Git** | any modern | — |

> [!TIP]
> The quickest way to spin up all services (PostgreSQL + Redis + backend) is via Docker Compose — see the [Docker route](#option-a-docker-compose-recommended) below.

---

## 1. Clone & Install

```bash
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main
npm install
```

---

## 2. Environment Variables

Copy the Docker example file and adjust as needed:

```bash
cp .env.docker .env
```

The key variables you may need to customise:

| Variable | Default (Docker) | Description |
|----------|------------------|-------------|
| `DATABASE_URL` | `postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev` | Full PostgreSQL connection string |
| `POSTGRES_USER` | `cocohub` | DB username (used by Docker only) |
| `POSTGRES_PASSWORD` | `cocohub_dev` | DB password (used by Docker only) |
| `POSTGRES_DB` | `cocohub_dev` | Database name (used by Docker only) |
| `REDIS_HOST` | `redis` (Docker) / `localhost` (local) | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `PORT` | `3000` | HTTP port the backend listens on |
| `JWT_SECRET` | `dev_jwt_secret_change_me` | **Change for any non-local environment** |
| `TOTP_ENCRYPTION_KEY` | `000…0` (64 hex chars) | AES-256-GCM key — generate with `openssl rand -hex 32` |
| `LOG_LEVEL` | `debug` | `debug` \| `info` \| `warn` \| `error` |
| `SERVICE_NAME` | `cocohub-api` | Appears in structured log output |
| `STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Horizon endpoint (testnet by default) |

> [!IMPORTANT]
> Never commit `.env` to version control. The `.gitignore` already excludes it.

---

## 3. Database Setup

### Option A — Docker Compose (recommended)

This starts PostgreSQL 15 + Redis 7 + the backend itself:

```bash
docker compose up -d postgres redis
```

Wait for the health checks to pass (≈ 10 seconds), then verify:

```bash
docker compose ps
```

Both `postgres` and `redis` should show `healthy`.

### Option B — Local PostgreSQL

1. Install PostgreSQL 15 ([postgresql.org/download](https://www.postgresql.org/download/)).
2. Create the database and user:

```sql
-- Run as the postgres superuser
CREATE USER cocohub WITH PASSWORD 'cocohub_dev';
CREATE DATABASE cocohub_dev OWNER cocohub;
```

3. Update `DATABASE_URL` in your `.env`:

```
DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
```

### Option C — Local Redis

```bash
# macOS
brew install redis && brew services start redis

# Linux
sudo apt install redis-server && sudo systemctl start redis
```

Update `.env`:

```
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 4. Running Migrations

Migrations live in `backend/migrations/` and are run automatically on server start. To run them manually:

```bash
npx tsx backend/config/database.ts migrate
```

Or via the npm script (if available):

```bash
npm run migrate
```

The migration runner uses `node-pg-migrate` with an advisory lock, so it is safe to run concurrently and idempotent — already-applied migrations are skipped automatically.

To **roll back** the last migration:

```bash
npm run migrate:rollback
```

---

## 5. Running the Backend

### Development (with hot-reload)

```bash
npx tsx backend/server/index.ts
```

Or start everything via Docker Compose:

```bash
docker compose up
```

The backend will be available at **http://localhost:3000**.

### Production

```bash
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled output
```

Or with PM2 (see `ecosystem.config.js`):

```bash
pm2 start ecosystem.config.js --env production
```

---

## 6. Health Check

Verify the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "checks": {
    "db":     { "status": "ok", "latencyMs": 2 },
    "redis":  { "status": "ok", "latencyMs": 1 },
    "horizon":{ "status": "ok", "latencyMs": 45 }
  }
}
```

If any check shows `"status": "error"`, confirm the relevant service is running and that the environment variables are correct.

---

## 7. Optional Tools

### pgAdmin (GUI for PostgreSQL)

```bash
docker compose --profile tools up -d pgadmin
```

Open **http://localhost:5050** — login with `admin@cocohub.local` / `pgadmin_dev` (from `.env.docker`). Add a server connection pointing to `postgres:5432`.

---

## 8. Common Issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ECONNREFUSED 5432` | PostgreSQL not running | `docker compose up -d postgres` |
| `ECONNREFUSED 6379` | Redis not running | `docker compose up -d redis` |
| `password authentication failed` | Wrong `DATABASE_URL` creds | Check `.env` vs what was used in `CREATE USER` |
| Migrations fail with `lock timeout` | Another migration in flight | Wait and retry; advisory lock releases automatically |
| `JWT_SECRET` validation error | Missing env var | Set `JWT_SECRET` in `.env` |

---

## 9. Directory Reference

```
backend/
├── config/
│   ├── database.ts       # pg Pool, migration runner, instrumented query
│   ├── redis.ts          # Redis client singleton
│   ├── logging.ts        # Pino logger configuration
│   └── index.ts          # Re-exports
├── migrations/           # node-pg-migrate SQL files (timestamped)
├── server/
│   ├── app.ts            # Express app factory
│   ├── routes/           # Route handlers
│   └── index.ts          # Server entry-point
├── services/             # Business logic services
└── server.ts             # Alternate entry / health-check server
```

---

*See also: [DEPLOYMENT.md](./DEPLOYMENT.md) · [SECURITY-SETUP.md](./SECURITY-SETUP.md) · [SCALING.md](./SCALING.md)*
