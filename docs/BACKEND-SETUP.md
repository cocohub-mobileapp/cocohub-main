# Backend Local Setup

This guide starts the Cocohub REST API with PostgreSQL and Redis for local
development. It matches the scripts and Docker services in this repository.

## Prerequisites

- Node.js 18 or newer
- npm
- Docker Desktop, or Docker Engine with the Compose plugin
- A terminal at the repository root

Install JavaScript dependencies first:

```bash
npm install --legacy-peer-deps
```

## Environment Files

The mobile/web app reads `.env.development`, while Docker Compose reads
`.env.docker`.

Create the app development file from the checked-in example:

```bash
cp .env.example .env.development
```

For the Docker backend, the repository already includes `.env.docker` with
development-only values:

- `POSTGRES_USER=cocohub`
- `POSTGRES_PASSWORD=cocohub_dev`
- `POSTGRES_DB=cocohub_dev`
- `DATABASE_URL=postgres://cocohub:cocohub_dev@postgres:5432/cocohub_dev`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `PORT=3000`

Do not reuse these values for staging or production.

## Start PostgreSQL, Redis, and the API

Start the full local backend stack:

```bash
docker-compose up
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Cocohub API on `http://localhost:3000`

The backend container runs:

```bash
npx tsx backend/server/index.ts
```

On startup, the server verifies the database connection and runs migrations
before listening.

If you want the services in the background:

```bash
docker-compose up -d
docker-compose logs -f backend
```

## Run Migrations Manually

The backend startup path runs migrations automatically, but you can also run
them from the host when PostgreSQL is available:

```bash
npm run migrate
```

The migration runner uses `backend/src/db/migrate.ts` and applies the ordered SQL
files from `backend/migrations/legacy`.

To roll back to a target migration version:

```bash
npx ts-node backend/src/db/migrate.ts rollback 4
```

Use rollback only for local development databases.

## Seed Development Data

After migrations finish, seed a small development dataset:

```bash
npm run seed:dev
```

This runs:

```bash
ts-node backend/seeds/index.ts --owners 5 --vets 3 --pets 2 --records 3 --appointments 2 --medications 1
```

For a smaller disposable dataset, use:

```bash
npm run seed:test
```

For a larger manual QA dataset, use:

```bash
npm run seed:large
```

The seeded demo owner login is:

```text
Email:    owner1@example.com
Password: Password123!
```

## Verify the API

Check the health and readiness endpoints:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

The server log should include:

```text
Cocohub REST API listening on http://localhost:3000/api
Health:  http://localhost:3000/api/health
Ready:   http://localhost:3000/api/ready
Admin:   http://localhost:3000/admin/api-keys.html
```

Open the local admin page only for development:

```text
http://localhost:3000/admin/api-keys.html
```

## Optional pgAdmin

Start pgAdmin with the `tools` profile:

```bash
docker-compose --profile tools up pgadmin
```

Then open:

```text
http://localhost:5050
```

Development credentials come from `.env.docker`:

```text
Email:    admin@cocohub.local
Password: pgadmin_dev
```

Use these PostgreSQL connection details inside pgAdmin:

```text
Host:     postgres
Port:     5432
Database: cocohub_dev
User:     cocohub
Password: cocohub_dev
```

## Troubleshooting

### Docker is not running

If `docker-compose up` fails with a daemon or connection error, start Docker
Desktop and rerun:

```bash
docker-compose up
```

### Port 3000, 5432, or 6379 is already in use

Stop the process using the port, or change the host-side port in
`docker-compose.yml`.

Useful checks:

```bash
# macOS/Linux
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Windows PowerShell
netstat -ano | findstr :3000
netstat -ano | findstr :5432
netstat -ano | findstr :6379
```

After changing ports, keep `DATABASE_URL`, `REDIS_HOST`, and `REDIS_PORT`
consistent with the running services.

### PostgreSQL is not ready yet

The Compose file waits for PostgreSQL health checks before starting the backend.
If you still see connection errors, inspect the database logs:

```bash
docker-compose logs postgres
docker-compose logs backend
```

Then restart the backend service:

```bash
docker-compose restart backend
```

### Migrations fail

Check which migration failed in the backend logs:

```bash
docker-compose logs backend
```

For a disposable local database, the fastest reset is:

```bash
docker-compose down -v
docker-compose up
npm run seed:dev
```

`docker-compose down -v` deletes the local PostgreSQL and Redis volumes.

### Seed data fails or duplicates data

Use the cleanup seed preset for a clean test-sized dataset:

```bash
npm run seed:test
```

For custom cleanup and seed counts:

```bash
npx ts-node backend/seeds/index.ts --cleanup --owners 3 --vets 2 --pets 1 --records 2 --appointments 1 --medications 1
```

### The app cannot reach the API

Confirm the backend is listening:

```bash
curl http://localhost:3000/api/health
```

Then confirm `.env.development` points to the local API:

```text
API_BASE_URL=http://localhost:3000/api
```

Restart the Expo dev server after changing environment files.

