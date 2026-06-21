# Sportykore API

Backend for **Sportykore** — a sports league management platform. This repository is an [AdonisJS 7](https://adonisjs.com) application that serves:

1. A **JSON REST API** (`/api/v1`) for the mobile app (Bearer token auth).
2. A small **React + Inertia** web UI for account login/signup and a home page (session auth).

The core domain covers countries, leagues, seasons, teams, players, games, match stats, standings, favourites, and player invites.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick start (local)](#quick-start-local)
- [Quick start (Docker)](#quick-start-docker)
- [Environment variables](#environment-variables)
- [What is already built](#what-is-already-built)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [API documentation](#api-documentation)
- [Database](#database)
- [File uploads](#file-uploads)
- [Real-time updates](#real-time-updates)
- [Development workflow](#development-workflow)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Further reading](#further-reading)

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js **≥ 24** |
| Framework | AdonisJS 7, VineJS validation, Lucid ORM |
| Web UI | React 19, Inertia.js, Vite |
| API typing / routes | [Tuyau](https://tuyau.dev) (generated client in `.adonisjs/client/`) |
| DB (local default) | SQLite (`tmp/db.sqlite3`) |
| DB (Docker dev / prod) | PostgreSQL 16 (Docker dev) / Neon (Cloud Run) |
| Cache / realtime | Redis (Upstash in prod) — rate limiter + Transmit SSE backplane |
| Auth | Session (`web` guard) + Bearer OTP tokens (`api` guard) |
| OAuth | Google via `@adonisjs/ally` (routes currently disabled; OTP is primary) |
| File storage | `@adonisjs/drive` — local `fs`, S3, or GCS (`DRIVE_DISK`) |
| Email | Resend or Amazon SES via `@adonisjs/mail` (`MAIL_MAILER`) |
| Live updates | `@adonisjs/transmit` (SSE on `games/{id}`; Redis backplane in prod) |
| Dates | [Luxon](https://moment.github.io/luxon/) (UTC in DB; clients send IANA timezones) |

---

## Prerequisites

- **Node.js 24+** and npm
- For Docker: Docker Desktop (or Docker Engine) + Docker Compose v2
- Optional: AWS credentials if you use S3 uploads or SES mail in dev

---

## Quick start (local)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
node ace generate:key   # sets APP_KEY in .env
```

Edit `.env` as needed. For the fastest local path, use defaults with SQLite (no `DB_CONNECTION` needed — it defaults to `sqlite`).

Google OAuth env vars are optional until you re-enable OAuth routes.

### 3. Migrate and seed

```bash
node ace migration:run
node ace db:seed --files database/seeders/data_seeder.ts
```

`migration:run` also regenerates `database/schema.ts` from your migrations — **do not edit that file by hand**.

The data seeder creates African countries, sample users/leagues/teams/games/stats, and favourite leagues. Inspect `database/seeders/data_seeder.ts` for volumes and passwords (factory defaults).

### 4. Start the dev server

```bash
node ace serve --hmr
```

- API + Inertia: [http://localhost:3333](http://localhost:3333)
- Web login: [http://localhost:3333/login](http://localhost:3333/login)

### 5. Call the API (OTP example)

```bash
# Request OTP (returning user — email must exist)
curl -s -X POST http://localhost:3333/api/v1/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}'

# Verify OTP → Bearer token
curl -s -X POST http://localhost:3333/api/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","code":"123456"}'

# Use data.auth.token.value as Bearer token, then:
curl -s http://localhost:3333/api/v1/countries/ng \
  -H "Authorization: Bearer <token>"
```

New users get `428` from `request-otp` until `name` (and optional `recoveryEmail`) are supplied. See [ROUTES.md — Authentication (OTP)](ROUTES.md#authentication-otp).

Seeded user emails depend on the factory; check the seeder or your DB after seeding.

---

## Quick start (Docker)

Docker dev runs the API against **PostgreSQL** (bundled in compose). Redis is **external** (e.g. Upstash) — configure `REDIS_*` in `.env.dev`.

### 1. Environment

```bash
cp .env.dev.example .env.dev
node ace generate:key   # paste into APP_KEY in .env.dev
```

Compose reads `${DB_*}` from `.env.dev` via `npm run dev` (`--env-file .env.dev`).

### 2. Build and start

```bash
npm run dev
# or: npm run dev:build
```

Services:

| Service | URL / port |
| --- | --- |
| API | [http://localhost:3333](http://localhost:3333) |
| PostgreSQL | `localhost:5432` (credentials from `.env.dev`) |

Stop: `npm run dev:down`

### 3. Seed (first time or after fresh DB)

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml exec api node ace db:seed --files database/seeders/data_seeder.ts
```

### 4. `node_modules` volume

Compose mounts a **named volume** for `/app/node_modules` so host bind-mounts do not break native modules. After adding npm packages:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml run --rm --no-deps api npm ci
docker compose --env-file .env.dev -f docker-compose.dev.yml up api -d
```

Production deploys the `production` stage in `Dockerfile` (Cloud Run). `docker-compose.prod.yml` is for local smoke tests only (`npm run prod:build`).

---

## Cloud Run (production)

Cloud Run builds and runs the **`Dockerfile` `production` target** — not `docker-compose.prod.yml`. Set environment variables in the Cloud Run service (copy from [`.env.prod.example`](.env.prod.example)).

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `8080` (Cloud Run sets this automatically) |
| `APP_URL` | Your Cloud Run URL |
| `DRIVE_DISK` | `gcs` |
| `GCS_BUCKET` | Your bucket name |
| `GCS_KEY` | **Omit** — Cloud Run uses ADC |
| `DB_*` | Neon / managed Postgres (`DB_SSL=true`) |
| `MAIL_MAILER` | `resend` or `ses` |
| `RESEND_API_KEY` | Required when `MAIL_MAILER=resend` |
| `LIMITER_STORE` | `redis` |
| `REDIS_*` | Upstash host, port, password, `REDIS_TLS=true` |

The production container runs **`node ace migration:run --force`** before starting the server (see `Dockerfile`). Remove that from the `CMD` when you move migrations to a Cloud Run Job.

Local smoke test: `cp .env.prod.example .env.prod`, fill in values, then `npm run prod:build`.

---

## Environment variables

Validated in `start/env.ts`. Copy [`.env.example`](.env.example) for local SQLite, [`.env.dev.example`](.env.dev.example) for Docker dev, or [`.env.prod.example`](.env.prod.example) for production.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `HOST`, `PORT` | HTTP bind (default `localhost:3333`) |
| `APP_KEY` | App secret — run `node ace generate:key` |
| `APP_URL` | Public app URL |
| `LOG_LEVEL` | Pino log level |
| `SESSION_DRIVER` | `cookie` \| `memory` \| `database` |
| `DB_CONNECTION` | `sqlite` (default) or `pg` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL` | PostgreSQL when `DB_CONNECTION=pg` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional — Google OAuth (routes disabled) |
| `MOBILE_OAUTH_DEEP_LINK` | Optional redirect after Google login |
| `MOBILE_APP_URL` | Base URL for invite deep links in emails |
| `DRIVE_DISK` | `fs` (local dev), `s3`, or `gcs` (Cloud Run prod) |
| `AWS_*`, `S3_BUCKET` | S3 disk + SES mail |
| `GCS_BUCKET`, `GCS_KEY` | GCS disk; omit `GCS_KEY` on Cloud Run (ADC) |
| `MAIL_MAILER` | `resend` (default) or `ses` — selects active mailer |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Outbound email identity |
| `RESEND_API_KEY` | Required when `MAIL_MAILER=resend` |
| `LIMITER_STORE` | `memory` (single instance) or `redis` (prod / multi-instance) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` | Redis for limiter + Transmit; set `REDIS_TLS=true` for Upstash |

Uploads (league/team logos, player avatars) use `DRIVE_DISK` via `FileService`.

**Note:** Local dev often uses `DRIVE_DISK=fs` and `LIMITER_STORE=memory`. Cloud Run production uses `DRIVE_DISK=gcs`, `LIMITER_STORE=redis`, and Upstash with TLS.

### GCS bucket setup (production)

1. **Create a bucket** in [Google Cloud Console](https://console.cloud.google.com/storage) (e.g. `your-project-uploads`). Pick a region close to your Cloud Run service.
2. **Uniform bucket-level access** — leave enabled (FlyDrive default). Do not rely on per-object ACLs.
3. **Public read** (required for `visibility: 'public'` in `config/drive.ts`):
   - Bucket → **Permissions** → **Grant access**
   - Principal: `allUsers`, Role: **Storage Object Viewer**
   - Confirm public access (logos and avatars are served via `getUrl()`).
4. **Service account** (local dev or when not using the Cloud Run runtime identity):
   - IAM → **Service accounts** → create one (e.g. `sportykore-uploads`)
   - Grant **Storage Object Admin** on the bucket (upload + delete)
   - Keys → **Add key** → JSON → save as `gcs_key.json` in the project root (gitignored)
5. **Environment:**

```env
DRIVE_DISK=gcs
GCS_BUCKET=your-project-uploads
GCS_KEY=file://gcs_key.json
```

On **Cloud Run**, omit `GCS_KEY` and assign the Cloud Run service account **Storage Object Admin** on the bucket; the `@google-cloud/storage` client uses Application Default Credentials automatically.

---

## What is already built

### Domain model (database)

Migrations under `database/migrations/` define:

| Entity | Purpose |
| --- | --- |
| `users` | Accounts (web + API) |
| `auth_access_tokens` | Bearer tokens for mobile (`kpk_` prefix, 30-day expiry) |
| `otp_codes` | One-time passwords for mobile OTP auth |
| `password_resets` | Password reset tokens (legacy web auth) |
| `countries` | Countries (`code`, `name`, optional `flagUrl`) |
| `leagues` | Leagues (owner `user_id`, country, logo, gender, description) |
| `seasons` | Seasons per league (`inactive` \| `active` \| `completed`) |
| `teams` | Teams per league |
| `players` | Player profiles (optional link to `user_id`) |
| `league_players` | Roster rows (team, season, position, status, jersey, captain) |
| `games` | Fixtures/results (`scheduled` \| `live` \| `break` \| `completed` \| `postponed` \| `cancelled`) |
| `stats` / `stat_types` | Match events (goals, assists, cards, subs, etc.) |
| `standings` | League table rows (updated when games finish) |
| `favourite_leagues` | User ↔ league favourites |
| `invites` | Player invite tokens for joining a team/league |

### Public JSON API (`/api/v1`)

| Area | Endpoints (summary) |
| --- | --- |
| **Countries** | List; detail by id or code (`stats`, leagues, teams, featured players, recent matches) |
| **Leagues** | Match feed (`leagues` + `matches` with `gameDate` / `timeZone`); league detail (`seasons`, `season`, `statTypes`); create league |
| **Discovery** | Global search (`/search`) |
| **Entities** | Game, team, player detail |
| **Favourites** | `POST` / `DELETE` `/leagues/:id/favorite` (US spelling in URL) |
| **Invites** | Accept invite, complete profile + accept |

### Authenticated API

| Area | Auth | Notes |
| --- | --- | --- |
| **Mobile auth** | Bearer | OTP `request-otp` / `verify-otp`, recover, logout, delete account — see [ROUTES.md](ROUTES.md#authentication-otp) |
| **Manage hub** | Bearer | `GET /api/v1/auth/users/me`, owned leagues, teams, user search |
| **League owner** | Bearer + `leagueOwner` middleware | Update league; CRUD seasons, teams, games, stats, roster; generate invites |

`leagueOwner` resolves ownership from `leagueId` in params/body/query, or from the parent game/stat/league-player row.

### Web (Inertia)

- `/` — home
- `/login`, `/signup`, `/logout` — session auth
- Shared props: `user`, `flash` via `InertiaMiddleware`

### Background behaviour

- **Standings:** `UpdateStandings` listener recalculates standings when game scores change or stats are deleted.
- **Transmit:** broadcasts game events on channel `games/{id}` via Redis backplane (`config/transmit.ts`; set `REDIS_TLS=true` for Upstash).

### Not enabled / commented out

- Legacy mobile **email/password** and **Google OAuth** routes in `start/routes.ts`
- `docker-compose` **worker** service (game worker) — stub only

---

## Project structure

```
app/
  controllers/     HTTP handlers (thin; delegate to services)
  services/        Business logic (LeagueService, PlayerService, CountryService, …)
  models/          Lucid models (extend generated *Schema from database/schema.ts)
  transformers/    API JSON shapes (single source of truth for responses)
  validators/      VineJS request rules
  middleware/      auth, apiAuth, guest, leagueOwner, inertia, …
  listeners/       Domain event handlers (e.g. standings)
  helpers/         Small formatters (match labels, player initials)
  events/          GameUpdated, etc.
config/            auth, database, drive, mail, transmit, …
database/
  migrations/      Schema source of truth
  seeders/         data_seeder.ts — rich demo data
  factories/       Test/seed factories
  schema.ts        GENERATED — do not edit
docs/              Feature guides (manage league, invites, timezones)
inertia/           React pages, layouts, app entry
providers/         api_provider (ctx.serialize), …
start/             routes.ts, kernel.ts, env.ts, events.ts
tests/             unit, functional, browser (Japa)
ROUTES.md          Full API route + payload reference (incl. OTP auth)
MOBILE_AUTH_ROUTES.md  Deprecated — legacy password/OAuth docs
AGENTS.md          AI/agent conventions (also useful for humans)
```

---

## Architecture

### Dual authentication

| Client | Guard | Middleware | Typical use |
| --- | --- | --- | --- |
| Browser (Inertia) | `web` (session) | `auth`, `guest` | `/login`, `/signup` |
| Mobile / API | `api` (Bearer) | `apiAuth` | `/api/v1/*` |

**Important:** Optional auth on public API routes (e.g. `GET /api/v1/leagues` for `isFavourited`) must use `auth.use('api').check()`, not the default `web` guard.

### Request flow

1. Route → middleware (`start/kernel.ts`, `start/routes.ts`)
2. Controller validates with Vine (`app/validators/*`)
3. Service performs queries / transactions (`app/services/*`)
4. Transformer shapes the response (`app/transformers/*`)
5. `ctx.serialize(payload)` wraps in `{ data: ... }` when using the API serializer (`providers/api_provider.ts`)

Some mutation endpoints return `{ message: ... }` or `{ inviteUrl: ... }` **without** the `data` wrapper — see `ROUTES.md`.

### Path aliases

Always import via `#` prefixes from `package.json`:

`#models/*`, `#services/*`, `#validators/*`, `#transformers/*`, `#middleware/*`, `#controllers/*`, `#generated/*`, `#helpers/*`, `#config/*`, etc.

### Generated code (do not edit)

- `database/schema.ts` — regenerated on `node ace migration:run`
- `.adonisjs/*` — Tuyau/Adonis registries
- Run `node ace migration:run` after migration changes; commit both migration and schema updates

### Timezones

All `played_at` values are stored in **UTC**. The matches feed filters by a **calendar day in the user’s IANA timezone** (`gameDate` + `timeZone` query params). See [docs/TIME_AND_TIMEZONE.md](docs/TIME_AND_TIMEZONE.md).

---

## API documentation

| Document | Contents |
| --- | --- |
| [ROUTES.md](ROUTES.md) | Every `/api/v1` route, OTP auth, request/response examples |
| [docs/MANAGE_LEAGUE.md](docs/MANAGE_LEAGUE.md) | League-owner manage flow (games, roster, settings) |
| [docs/PLAYER_INVITE.md](docs/PLAYER_INVITE.md) | Invite generation and acceptance |
| [docs/TIME_AND_TIMEZONE.md](docs/TIME_AND_TIMEZONE.md) | Match-day filtering rules |

Base URL in development: `http://localhost:3333/api/v1`.

---

## Database

### Commands

```bash
node ace migration:run              # Apply migrations + regenerate schema.ts
node ace migration:fresh            # Drop all tables and re-run migrations
node ace migration:rollback         # Roll back last batch
node ace db:seed --files database/seeders/data_seeder.ts
```

### Connections

| Environment | `DB_CONNECTION` | Location |
| --- | --- | --- |
| Local default | `sqlite` (implicit) | `tmp/db.sqlite3` |
| Docker Compose | `pg` (set in compose) | Postgres container |
| Tests | see `.env.test` | Isolated test DB |

### Conventions

- Migrations: **snake_case** columns
- Models / `schema.ts`: **camelCase** properties (`full_name` → `fullName`)
- Vine date fields → Luxon `DateTime` via `start/validator.ts`

---

## File uploads

- **Config:** `config/drive.ts` — `s3` and `fs` services
- **Uploads:** `DRIVE_DISK=fs` → `storage/` + `/uploads/…`; `gcs` → public GCS URLs; `s3` → S3 URLs
- **Service:** `app/services/file_service.ts`
- Validators: `optionalImage()` in `app/validators/common.ts` (max 2 MB, jpg/png/webp)

Ensure `storage/` exists and is writable in local/Docker dev.

---

## Real-time updates

When game results or stats change, `GameUpdated` fires → `UpdateStandings` listener updates standings and broadcasts on Transmit channel `games/{gameId}`.

Subscribe from clients using [@adonisjs/transmit](https://docs.adonisjs.com/guides/realtime/transmit) conventions. Production uses a **Redis backplane** (`config/transmit.ts`) so multiple Cloud Run instances share SSE events. Set `REDIS_TLS=true` when using Upstash.

Import the Redis transport directly to avoid optional MQTT peer deps:

```ts
import { redis } from '@adonisjs/transmit/transports/redis'
```

---

## Development workflow

```bash
npm run dev:server   # Local Adonis + Vite HMR (no Docker)
npm run dev          # Docker dev (Postgres + API)
npm run build        # Production build
npm run typecheck    # tsc (backend + inertia)
npm run lint         # ESLint
npm run format       # Prettier
npm test             # All Japa suites
node ace test unit   # Unit only
```

### Adding a migration

1. `node ace make:migration <name>`
2. Implement `up` / `down`
3. `node ace migration:run`
4. Commit migration + updated `database/schema.ts`

### Adding an API endpoint

1. Route in `start/routes.ts` (use `controllers` registry from `#generated/controllers`)
2. Validator in `app/validators/`
3. Service method if non-trivial
4. Controller action + `serialize(...)` or direct `response`
5. Transformer variant if needed
6. Document in `ROUTES.md`

### Inertia pages

- Entry: `inertia/app.tsx`
- Layout: `inertia/layouts/default.tsx`
- Use **named routes** in `<Link route="...">` / `<Form route="...">`, not hardcoded paths

---

## Testing

```bash
npm test                  # All suites
node ace test unit
node ace test functional  # Starts HTTP server via test utils
```

- Config: `tests/bootstrap.ts`, `bin/test.ts`
- DB helpers: `tests/helpers/migration.ts` (`withFreshDatabase`, `withFreshDatabaseAndCountries`)

Functional/browser suites expect the app to boot; use `.env.test` for test-specific env.

---

## Troubleshooting

### Docker: Redis / Transmit connection errors

Upstash and other managed Redis hosts require TLS. Set `REDIS_TLS=true` and use the hostname only (no `https://` prefix) in `REDIS_HOST`. Import `@adonisjs/transmit/transports/redis`, not `@adonisjs/transmit/transports`.

### Docker: `Cannot find package '@adonisjs/drive'` (or other packages)

Stale `node_modules` volume. See [Quick start (Docker)](#4-node_modules-volume).

### `GET /api/v1/leagues` always shows `isFavourited: false`

Send `Authorization: Bearer <token>` on the GET request. Favourites use the **`api`** guard; session cookies are not used for that field. Check `data.matches`, not `data.leagues`.

### Migrations fail on SQLite vs Postgres

Use the same `DB_CONNECTION` you intend to run. Docker sets `pg`; local default is `sqlite`. Enum/check syntax is aligned for both in migrations.

### OAuth / mail / S3 errors in dev

Placeholders in `.env.example` are enough to boot the server. Real Google/AWS credentials are only required when exercising those integrations.

---

## Further reading

- [AGENTS.md](AGENTS.md) — conventions for contributors and coding agents
- [CLAUDE.md](CLAUDE.md) — condensed architecture notes
- [AdonisJS docs](https://docs.adonisjs.com)
- [Inertia.js docs](https://inertiajs.com)

---

## License

UNLICENSED (private project — see `package.json`).
