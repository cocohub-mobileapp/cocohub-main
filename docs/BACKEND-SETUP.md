# Backend API Local Setup

This guide gets the Cocohub backend running locally with Docker, PostgreSQL, Redis, migrations, seed data, and a quick API verification check.

## Prerequisites

- Node.js 18 or newer
- npm
- Docker Desktop or Docker Engine with Docker Compose
- Git
- A terminal with access to ports `3000`, `5432`, and `6379`

## 1. Clone And Install

```bash
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main
npm install --legacy-peer-deps
```

## 2. Create Local Environment Files

Create the app environment file from the example:

```bash
cp .env.example .env.development
```

For Docker, the compose file reads `.env.docker`. If it does not exist yet, create it with local-only development values:

```bash
cat > .env.docker <<'EOF'
POSTGRES_USER=cocohub
POSTGRES_PASSWORD=cocohub_dev
POSTGRES_DB=cocohub_dev
PGADMIN_EMAIL=admin@cocohub.local
PGADMIN_PASSWORD=pgadmin_dev
JWT_SECRET=local_dev_jwt_secret_change_me
TOTP_ENCRYPTION_KEY=
EOF
```

Useful local defaults:

```env
API_BASE_URL=http://localhost:3000/api
DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
REDIS_HOST=localhost
REDIS_PORT=6379
```

Do not commit `.env.development` or `.env.docker` with real secrets.

## 3. Start PostgreSQL, Redis, And The Backend

Use the existing Docker Compose stack:

```bash
docker-compose up
```

This starts:

- PostgreSQL 15 on `localhost:5432`
- Redis 7 on `localhost:6379`
- Backend API on `localhost:3000`

If you only want database services in one terminal and the backend in another, start dependencies first:

```bash
docker-compose up postgres redis
npm run server
```

## 4. Run Migrations

After Postgres is healthy, run:

```bash
npm run migrate
```

This applies the SQL migrations under `backend/migrations/` using the project migration runner.

## 5. Seed Development Data

Load local test users, vets, pets, records, appointments, and medications:

```bash
npm run seed:dev
```

Test credentials after seeding:

```text
Email:    owner1@example.com
Password: Password123!
```

## 6. Verify The API

Check that the backend is responding:

```bash
curl http://localhost:3000/api/health
```

If the health route is unavailable in your current branch, verify the docs route or OpenAPI route instead:

```bash
curl http://localhost:3000/api/docs
curl http://localhost:3000/api/openapi.json
```

You can also open the app with the seeded account and confirm requests are going to `http://localhost:3000/api`.

## Troubleshooting

### Port 5432 Is Already In Use

Another Postgres instance is running. Stop it or change the host port in `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"
```

If you change the port, update `DATABASE_URL` to use `localhost:5433`.

### Port 3000 Is Already In Use

Stop the process using port 3000 or change the backend port mapping. If you change the API port, update `API_BASE_URL` in `.env.development`.

### Docker Is Not Running

If `docker-compose up` cannot connect to Docker, start Docker Desktop or the Docker daemon, then rerun the command.

### Postgres Is Not Ready When Migrations Run

Wait until Docker reports the `postgres` service as healthy, then rerun:

```bash
npm run migrate
```

### Migration Fails Because Tables Already Exist

For a disposable local database, reset the Docker volume:

```bash
docker-compose down -v
docker-compose up postgres redis
npm run migrate
npm run seed:dev
```

Only use `docker-compose down -v` for local development data you can safely delete.

### Seed Fails After A Partial Run

Run the test seed cleanup path or reset the local volume:

```bash
npm run seed:test
# or, for a clean local reset:
docker-compose down -v
```

### API Cannot Connect To Redis

Confirm Redis is running:

```bash
docker-compose ps redis
```

When running the backend outside Docker, use:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

When running inside Docker Compose, the backend uses the service name:

```env
REDIS_HOST=redis
REDIS_PORT=6379
```

## Quick Command Summary

```bash
npm install --legacy-peer-deps
cp .env.example .env.development
docker-compose up postgres redis
npm run migrate
npm run seed:dev
npm run server
```
