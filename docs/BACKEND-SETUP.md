# Backend API Local Setup

This guide walks through running the Cocohub backend locally with Docker,
PostgreSQL, Redis, migrations, and seed data.

## Prerequisites

- Node.js 18 or newer
- npm
- Docker Desktop or a compatible Docker engine with Docker Compose
- Git

Check the local tools before starting:

```bash
node --version
npm --version
docker --version
docker compose version
```

## 1. Install Dependencies

From the repository root:

```bash
npm install --legacy-peer-deps
```

The Docker backend service also runs `npm install` inside the container, but
installing dependencies locally lets you run migrations, seed scripts, tests,
and lint commands from your shell.

## 2. Review Local Environment

The Docker stack reads `.env.docker`. It is already configured for local
development:

```env
POSTGRES_USER=cocohub
POSTGRES_PASSWORD=cocohub_dev
POSTGRES_DB=cocohub_dev
DATABASE_URL=postgres://cocohub:cocohub_dev@postgres:5432/cocohub_dev
REDIS_HOST=redis
REDIS_PORT=6379
PORT=3000
JWT_SECRET=dev_jwt_secret_change_me
```

Use these values only for local development. For non-Docker commands run from
your host machine, use a localhost database URL:

```bash
export DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
export REDIS_HOST=localhost
export REDIS_PORT=6379
export JWT_SECRET=dev_jwt_secret_change_me
export TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

## 3. Start PostgreSQL, Redis, and the API

Start the full Docker stack:

```bash
docker compose up
```

This starts:

| Service | Local endpoint | Notes |
| --- | --- | --- |
| Backend API | `http://localhost:3000` | Express API served under `/api` |
| PostgreSQL | `localhost:5432` | Database `cocohub_dev` |
| Redis | `localhost:6379` | Session/cache support |

The backend waits for PostgreSQL and Redis health checks before starting. When
it is ready, logs should include:

```text
Cocohub REST API listening on http://localhost:3000/api
Health:  http://localhost:3000/api/health
Ready:   http://localhost:3000/api/ready
```

To run only the backing services and start the API from your host shell, use:

```bash
docker compose up postgres redis
npm run server
```

## 4. Run Migrations

The backend startup path calls `runMigrations()`, but contributors can also run
migrations explicitly from the host after PostgreSQL is healthy:

```bash
export DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
npm run migrate
```

Expected output should show pending migrations being applied or existing
migrations being skipped. If the command reports that migrations are already
applied, that is fine.

## 5. Seed Development Data

After migrations complete, seed a local dataset:

```bash
export DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
npm run seed:dev
```

Useful seed variants:

```bash
npm run seed:test
npm run seed:large
```

The default development seed creates pet owners, veterinarians, pets, medical
records, appointments, and medications. Use the seeded owner account from the
main README when testing auth flows:

```text
Email:    owner1@example.com
Password: Password123!
```

## 6. Verify the API

Check health and readiness:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Expected responses include `ok: true`. You can also open the API docs route if
the server is running:

```text
http://localhost:3000/api/docs
```

For an end-to-end local stack, run the web app in a second terminal:

```bash
npx expo start --web
```

Then open `http://localhost:8081`.

## 7. Optional pgAdmin

The compose file includes pgAdmin behind the `tools` profile:

```bash
docker compose --profile tools up pgadmin
```

Open `http://localhost:5050` and sign in with:

```text
Email:    admin@cocohub.local
Password: pgadmin_dev
```

Register a server that points to host `postgres`, port `5432`, user `cocohub`,
password `cocohub_dev`, and database `cocohub_dev`.

## Troubleshooting

### Docker Is Not Running

If `docker compose up` fails with a Docker daemon error, start Docker Desktop
or your Docker service, then rerun:

```bash
docker compose up
```

### Port 3000, 5432, or 6379 Is Already in Use

Find the process using the port and stop it, or temporarily change the host port
mapping in `docker-compose.yml`.

Common checks:

```bash
lsof -i :3000
lsof -i :5432
lsof -i :6379
```

### PostgreSQL Health Check Does Not Pass

Remove and recreate the local database containers if the volume is corrupt or
contains incompatible state:

```bash
docker compose down
docker volume rm cocohub-main_postgres_data
docker compose up postgres redis
```

This deletes local development data. Do not run it against any non-local
database.

### Migration Fails From the Host

Host commands must use `localhost`, not the Docker service name `postgres`:

```bash
export DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
npm run migrate
```

If the backend container is running migrations at the same time, wait for it to
finish before running the host migration command.

### Seed Fails Because Tables Are Missing

Run migrations first:

```bash
npm run migrate
npm run seed:dev
```

### API Health Check Fails

Confirm the backend container is running:

```bash
docker compose ps
```

Then inspect logs:

```bash
docker compose logs backend
docker compose logs postgres
docker compose logs redis
```

### Environment Variables Are Not Applied

Docker reads `.env.docker`; host commands read your shell environment. If you
change `.env.docker`, recreate the backend container:

```bash
docker compose up --force-recreate backend
```

For host commands, re-export the variables in your terminal before running
`npm run migrate`, `npm run seed:dev`, or `npm run server`.
