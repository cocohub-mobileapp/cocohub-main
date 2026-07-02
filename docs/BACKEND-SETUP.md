# Backend API Local Setup

This guide walks through running the Cocohub backend API locally with Docker,
PostgreSQL, Redis, migrations, and seed data.

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Docker Desktop, Docker Engine, or another Docker Compose compatible runtime
- Git
- A terminal with access to the repository root

Confirm the tools are available:

```bash
node --version
npm --version
docker --version
docker compose version
```

## 1. Clone and Install Dependencies

```bash
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag matches the root README setup and avoids peer
dependency conflicts while installing the React Native, Expo, and backend
workspace dependencies together.

## 2. Configure Environment Variables

The Docker Compose stack reads `.env.docker`. A development-safe file is already
included in the repository. Check or adjust the values before starting the
stack:

```bash
cat .env.docker
```

The most important local values are:

```env
POSTGRES_USER=cocohub
POSTGRES_PASSWORD=cocohub_dev
POSTGRES_DB=cocohub_dev
JWT_SECRET=your_jwt_secret_key_here
TOTP_ENCRYPTION_KEY=
GOOGLE_PLACES_API_KEY=
```

For basic backend development, `POSTGRES_*` and `JWT_SECRET` are enough. Optional
third-party integrations can stay blank until a feature specifically requires
them.

If you run the backend outside Docker, copy the app environment template and
point the API at local services:

```bash
cp .env.example .env
```

Then set:

```env
API_BASE_URL=http://localhost:3000/api
DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
```

## 3. Start PostgreSQL, Redis, and the API

From the repository root:

```bash
docker compose up
```

This starts:

- PostgreSQL 15 on `localhost:5432`
- Redis 7 on `localhost:6379`
- Cocohub backend API on `localhost:3000`

The backend container runs:

```bash
npm install && npx tsx backend/server/index.ts
```

Wait until PostgreSQL is healthy and the backend logs show that the server is
listening before running migrations.

To run the stack in the background:

```bash
docker compose up -d
```

To stop it:

```bash
docker compose down
```

## 4. Run Database Migrations

In a second terminal, from the repository root:

```bash
npm run migrate
```

The migration command runs `backend/src/db/migrate.ts` and applies the SQL files
under `backend/migrations/`.

If you want to validate migration files without applying them:

```bash
npm run migrations:validate
```

## 5. Seed Development Data

After migrations finish, load sample owners, vets, pets, records,
appointments, and medications:

```bash
npm run seed:dev
```

The root README lists these development credentials after seeding:

```text
Email:    owner1@example.com
Password: Password123!
```

For smaller or repeatable test data, use:

```bash
npm run seed:test
```

To clean up and recreate the database from scratch, stop the stack and remove
the PostgreSQL volume:

```bash
docker compose down -v
docker compose up -d
npm run migrate
npm run seed:dev
```

## 6. Verify the API Is Running

Check the API process:

```bash
curl http://localhost:3000
```

If the root route is not useful for the feature you are testing, check an API
route that exists in the backend router, for example:

```bash
curl http://localhost:3000/api
```

You can also inspect the OpenAPI assets generated under `backend/docs/` and use
the route files under `backend/server/routes/` or `backend/src/routes/` to find
the endpoint you need.

For a quick container-level check:

```bash
docker compose ps
docker compose logs backend
```

## 7. Optional: Use pgAdmin

The compose file includes pgAdmin behind the `tools` profile:

```bash
docker compose --profile tools up -d pgadmin
```

Open `http://localhost:5050` and log in with:

```text
Email:    admin@cocohub.local
Password: pgadmin_dev
```

Add a server connection with:

```text
Host:     postgres
Port:     5432
Database: cocohub_dev
User:     cocohub
Password: cocohub_dev
```

## Troubleshooting

### Docker Is Not Running

If `docker compose up` fails with a connection error, start Docker Desktop or
your Docker daemon and retry:

```bash
docker info
docker compose up
```

### Port 3000, 5432, or 6379 Is Already in Use

Another local service may already be using the backend, PostgreSQL, or Redis
port. Find the process and stop it, or change the host port mapping in
`docker-compose.yml`.

On macOS or Linux:

```bash
lsof -i :3000
lsof -i :5432
lsof -i :6379
```

On Windows PowerShell:

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5432
netstat -ano | findstr :6379
```

### Migrations Cannot Connect to PostgreSQL

Make sure the database container is healthy:

```bash
docker compose ps postgres
docker compose logs postgres
```

Confirm the connection string matches the compose defaults:

```env
DATABASE_URL=postgres://cocohub:cocohub_dev@localhost:5432/cocohub_dev
```

If the database schema is partially applied, reset the local volume and run the
migrations again:

```bash
docker compose down -v
docker compose up -d
npm run migrate
```

### Seed Data Fails

Run migrations first:

```bash
npm run migrate
npm run seed:dev
```

If seed data conflicts with existing rows, reset the database volume or use the
test seed command with cleanup:

```bash
npm run seed:test
```

### Backend Container Reinstalls Dependencies Slowly

The backend service runs `npm install` inside the container at startup. The first
run can take several minutes. Subsequent runs are faster if Docker keeps the
anonymous `/app/node_modules` volume.

If dependency installation becomes stale or corrupted, recreate the containers:

```bash
docker compose down
docker compose up --build
```

### API Starts but Requests Fail

Check backend logs:

```bash
docker compose logs -f backend
```

Common causes are missing environment variables, a database that has not been
migrated, or a route path that differs from the one being tested. Use
`backend/server/routes/` and `backend/src/routes/` as the source of truth for
available local API routes.
