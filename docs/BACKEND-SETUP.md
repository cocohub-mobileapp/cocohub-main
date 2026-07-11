# Backend API local setup (Docker + PostgreSQL)

This guide walks through running the Cocohub REST API locally with PostgreSQL and Redis via Docker Compose, applying migrations, seeding dev data, and verifying the API is healthy.

> **Payment:** Cocohub bounties on GrantFox use [smart escrow](https://grantfox.xyz) — funds release within 48h of merge.

## Prerequisites

- **Node.js 18+**
- **Docker Desktop** (running — whale icon in the system tray)
- **Git**
- Cocohub repo cloned

Optional: [pgAdmin](https://www.pgadmin.org/) (included as an optional Compose profile)

## 1. Clone and install dependencies

```bash
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main
npm install --legacy-peer-deps
```

The root `package.json` installs both the Expo mobile/web app and backend tooling.

## 2. Review environment files

Cocohub ships two env templates:

| File | Purpose |
|------|---------|
| `.env.docker` | Used by `docker-compose.yml` — Postgres, Redis, JWT, API port |
| `.env.example` | Mobile app / API client defaults — copy to `.env` if running the app against local API |

For Docker-based backend development you usually **do not** need to edit `.env.docker` — defaults are fine for local dev:

- Postgres: `cocohub` / `cocohub_dev` on port **5432**
- Redis: port **6379**
- API: **http://localhost:3000/api**

If you run the mobile app against the local API, copy `.env.example` → `.env` and set:

```bash
API_BASE_URL=http://localhost:3000/api
```

## 3. Start PostgreSQL, Redis, and the API

From the repo root:

```bash
docker-compose up
```

This starts:

1. **postgres** — PostgreSQL 15 with a health check
2. **redis** — Redis 7
3. **backend** — Node 18 container that runs `npm install` and `npx tsx backend/server/index.ts`

On startup the server:

- Verifies the database connection
- Runs pending **node-pg-migrate** migrations automatically
- Listens on **http://localhost:3000**

Leave this terminal open, or run detached:

```bash
docker-compose up -d
docker-compose logs -f backend
```

### Optional: pgAdmin database UI

```bash
docker-compose --profile tools up
```

Open **http://localhost:5050** — login with `admin@cocohub.local` / `pgadmin_dev` (from `.env.docker`).

## 4. Run migrations manually (if needed)

The API runs migrations on every boot. To apply them explicitly from the host (outside the container):

```bash
# Ensure DATABASE_URL points at the Docker Postgres instance
set DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev   # Windows
# export DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev  # macOS/Linux

npm run migrate
```

## 5. Seed development data

With Postgres running:

```bash
npm run seed:dev
```

This creates sample owners, vets, pets, records, appointments, and medications. Other presets:

| Command | Use case |
|---------|----------|
| `npm run seed` | Default seed (same script, default counts) |
| `npm run seed:test` | Minimal dataset + cleanup |
| `npm run seed:large` | Stress / pagination testing |

**Test login after seeding:**

```
Email:    owner1@example.com
Password: Password123!
```

## 6. Verify the API is running

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Expected: HTTP **200** with JSON status payloads.

Interactive API docs (when the server is up):

```bash
npm run docs:serve
# → http://localhost:3001/api/docs
```

Smoke-test auth:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"owner1@example.com\",\"password\":\"Password123!\"}"
```

You should receive a JWT access token in the response.

## 7. Connect the mobile / web app

```bash
npx expo start --web
```

Ensure `.env` has `API_BASE_URL=http://localhost:3000/api`. The web app at **http://localhost:8081** will use the live backend instead of demo mode.

## Troubleshooting

### Docker is not running

**Symptom:** `Cannot connect to the Docker daemon` or `connection refused` on port 5432.

**Fix:** Start Docker Desktop and wait until it reports "Running", then retry `docker-compose up`.

### Port 5432 or 3000 already in use

**Symptom:** `Bind for 0.0.0.0:5432 failed: port is already allocated`.

**Fix:**

- Stop a local Postgres instance, or change the host port in `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL` accordingly.
- For port 3000 conflicts, stop other Node processes or set `PORT=3001` in `.env.docker`.

### Migration failures

**Symptom:** Server exits with migration errors on startup.

**Fix:**

1. Check Postgres is healthy: `docker-compose ps`
2. Reset dev data (destructive): `docker-compose down -v` then `docker-compose up`
3. Re-run: `npm run migrate`

### Backend container keeps restarting

**Symptom:** `docker-compose ps` shows backend in a restart loop.

**Fix:** Inspect logs:

```bash
docker-compose logs backend
```

Common causes: failed `npm install` (network), missing `.env.docker`, or Postgres not ready (wait for health check).

### `npm run seed:dev` fails with connection errors

**Fix:** Confirm Postgres is reachable:

```bash
docker-compose ps postgres
```

Set `DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev` before seeding from the host.

### API health OK but login returns 401

**Fix:** Run `npm run seed:dev` — the test user may not exist yet.

## Next steps

- **Stellar / blockchain dev:** [STELLAR-SETUP.md](./STELLAR-SETUP.md)
- **OpenAPI docs tooling:** [backend/docs/README.md](../backend/docs/README.md)
- **Contributing & bounties:** [CONTRIBUTING.md](../CONTRIBUTING.md)

## Related scripts

| Script | Description |
|--------|-------------|
| `npm run dev:docker` | Alias for `docker-compose up` |
| `npm run migrate` | Apply legacy SQL migrations via `backend/src/db/migrate.ts` |
| `npm run seed:dev` | Seed dev fixtures |
| `npm run docs:serve` | Swagger UI for the REST API |
| `npm run docs:validate` | Validate OpenAPI spec |

---

*Questions? Open a [GitHub issue](https://github.com/cocohub-mobileapp/cocohub-main/issues) or see [CONTRIBUTING.md](../CONTRIBUTING.md).*
