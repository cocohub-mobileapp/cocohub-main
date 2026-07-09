# Backend API Local Setup

This guide explains how to run the Cocohub backend API locally with Docker, PostgreSQL, Redis, migrations, and development seed data.

## Prerequisites

Install the following first:

- Node.js 18 or newer
- npm 9 or newer
- Docker Desktop or a compatible Docker Engine
- Git
- Optional: `psql` for direct PostgreSQL inspection

Verify the tools:

```bash
node --version
npm --version
docker --version
docker compose version
```

## 1. Clone and install dependencies

```bash
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is recommended for this monorepo because the mobile and backend packages share dependencies with React Native and Expo.

## 2. Configure environment variables

The repository includes two local-development environment files:

- `.env.example` — app/API defaults for local development.
- `.env.docker` — Docker Compose defaults for PostgreSQL, Redis, and the backend container.

For a normal Docker setup, `.env.docker` is already referenced by `docker-compose.yml`, so no extra file is required.

If you want to run the backend directly on the host while still using Docker for PostgreSQL and Redis, create a local `.env` file from `.env.example` and override the database host:

```bash
cp .env.example .env
```

Use this local host database URL in `.env`:

```env
DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
JWT_SECRET=dev_jwt_secret_change_me
TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

Do not reuse these development secrets in staging or production.

## 3. Start PostgreSQL, Redis, and the backend with Docker

The simplest full-stack backend path is Docker Compose:

```bash
docker compose up
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Cocohub backend API on `localhost:3000`

The backend service runs:

```bash
npm install && npx tsx backend/server/index.ts
```

On startup, `backend/server/index.ts` verifies the database connection and runs pending PostgreSQL migrations through `node-pg-migrate`.

To run containers in the background:

```bash
docker compose up -d
```

To follow backend logs:

```bash
docker compose logs -f backend
```

To stop everything:

```bash
docker compose down
```

To stop and remove local database/Redis volumes as well:

```bash
docker compose down -v
```

## 4. Optional: run only PostgreSQL and Redis in Docker

If you prefer running the API directly with Node.js on your host:

```bash
docker compose up -d postgres redis
npm run server
```

Make sure your host `.env` uses `localhost` for PostgreSQL and Redis, not the Docker network hostnames used inside Compose.

## 5. Run migrations manually

The backend automatically runs `node-pg-migrate` migrations on startup. For local maintenance or legacy migration checks, you can also run:

```bash
npm run migrate
```

Useful migration validation commands:

```bash
npm run migrations:validate
npm run test:migrations
```

If a migration fails, check:

- The `DATABASE_URL` points to the right host (`postgres` inside Docker, `localhost` on the host).
- PostgreSQL is healthy: `docker compose ps postgres`.
- Previous failed attempts did not leave a partial schema. For a fresh local reset, run `docker compose down -v` and start again.

## 6. Seed development data

After migrations are applied, seed sample owners, vets, pets, records, appointments, and medications:

```bash
npm run seed:dev
```

Other useful seed commands:

```bash
npm run seed          # default seed configuration
npm run seed:test     # cleanup + small deterministic test dataset
npm run seed:large    # larger local dataset for manual testing
```

The README demo credentials are:

```text
Email:    owner1@example.com
Password: Password123!
```

## 7. Verify the API is running

Health and readiness endpoints:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Expected health response is a JSON payload indicating the API is up. The server logs also print:

```text
Cocohub REST API listening on http://localhost:3000/api
Health:  http://localhost:3000/api/health
Ready:   http://localhost:3000/api/ready
Admin:   http://localhost:3000/admin/api-keys.html
```

You can also open the admin API keys page:

```text
http://localhost:3000/admin/api-keys.html
```

## 8. Connect the mobile or web app to the local API

Use this API base URL for local app development:

```env
API_BASE_URL=http://localhost:3000/api
```

Then start the Expo app:

```bash
npx expo start --web
```

For Android emulator networking, `localhost` from the emulator may refer to the emulator itself. Use `10.0.2.2` if needed:

```env
API_BASE_URL=http://10.0.2.2:3000/api
```

For a physical device, use your computer's LAN IP address, for example:

```env
API_BASE_URL=http://192.168.1.20:3000/api
```

## Troubleshooting

### Docker is not running

Symptom:

```text
Cannot connect to the Docker daemon
```

Fix:

- Start Docker Desktop.
- Wait until Docker reports it is running.
- Retry `docker compose up`.

### Port 3000, 5432, or 6379 is already in use

Symptom:

```text
Bind for 0.0.0.0:3000 failed: port is already allocated
```

Fix:

- Stop the process using the port, or
- Change the host port mapping in `docker-compose.yml`.

Common checks:

```bash
# macOS/Linux
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 5432
Get-NetTCPConnection -LocalPort 6379
```

### Backend cannot connect to PostgreSQL

Symptom:

```text
ECONNREFUSED
password authentication failed
getaddrinfo ENOTFOUND postgres
```

Fix:

- Inside Docker Compose, use host `postgres`.
- From your host machine, use host `localhost`.
- Confirm the credentials match `.env.docker`:

```env
POSTGRES_USER=cocohub
POSTGRES_PASSWORD=cocohub_dev
POSTGRES_DB=cocohub_dev
```

Check container health:

```bash
docker compose ps
docker compose logs postgres
```

### Migrations fail or schema looks stale

For a clean local database reset:

```bash
docker compose down -v
docker compose up -d postgres redis
docker compose up backend
npm run seed:dev
```

If you are running the backend on the host, run:

```bash
npm run migrate
npm run seed:dev
```

### `npm install` fails with peer dependency conflicts

Use:

```bash
npm install --legacy-peer-deps
```

If dependencies are still inconsistent:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install --legacy-peer-deps
```

### Seed command fails

Check that:

- Migrations have completed successfully.
- `DATABASE_URL` points to the local database you actually started.
- The database is reachable with `docker compose ps postgres`.

For a deterministic small seed, try:

```bash
npm run seed:test
```

## Quick command summary

```bash
# Full backend stack
npm install --legacy-peer-deps
docker compose up -d
npm run seed:dev
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready

# Host API + Docker PostgreSQL/Redis
cp .env.example .env
docker compose up -d postgres redis
npm run server
npm run seed:dev
```
