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
| DB (Docker) | PostgreSQL 16 |
| Cache / infra (Docker) | Redis 7 (+ RedisInsight on port 5540) |
| Auth | Session (`web` guard) + Bearer access tokens (`api` guard) |
| OAuth | Google via `@adonisjs/ally` |
| File storage | `@adonisjs/drive` — S3 and local `fs` disks |
| Email | Amazon SES via `@adonisjs/mail` |
| Live updates | `@adonisjs/transmit` (SSE broadcast on game updates) |
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

Google OAuth placeholders are fine until you test OAuth; use `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from Google Cloud Console when ready.

### 3. Migrate and seed

```bash
node ace migration:run
node ace db:seed --files database/seeders/data_seeder.ts
```

`migration:run` also regenerates `database/schema.ts` from your migrations — **do not edit that file by hand**.

The data seeder creates African countries, sample users/leagues/teams/games/stats, and favourite leagues. Inspect `database/seeders/data_seeder.ts` for volumes and passwords (factory defaults).

### 4. Start the dev server

```bash
npm run dev
```

- API + Inertia: [http://localhost:3333](http://localhost:3333)
- Web login: [http://localhost:3333/login](http://localhost:3333/login)

### 5. Call the API (example)

```bash
# Login (mobile)
curl -s -X POST http://localhost:3333/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"password"}'

# Use data.auth.token.value as Bearer token, then:
curl -s http://localhost:3333/api/v1/countries/ng \
  -H "Authorization: Bearer <token>"
```

Seeded user emails depend on the factory; check the seeder or your DB after seeding.

---

## Quick start (Docker)

Docker runs the API against **PostgreSQL** and **Redis**, with migrations applied on container start.

### 1. Environment

Ensure `.env` exists (copy from `.env.example`) and includes at least:

```env
APP_KEY=<generated-secret>
```

Compose overrides DB settings to point at the `postgres` service (`DB_CONNECTION=pg`, etc.).

### 2. Build and start

```bash
docker compose up --build
```

Services:

| Service | URL / port |
| --- | --- |
| API | [http://localhost:3333](http://localhost:3333) |
| PostgreSQL | `localhost:5432` (user `sportykore`, db `sportykore_dev`) |
| Redis | `localhost:6379` |
| RedisInsight | [http://localhost:5540](http://localhost:5540) |

### 3. Seed (first time or after fresh DB)

```bash
docker compose exec api node ace db:seed --files database/seeders/data_seeder.ts
```

### 4. `node_modules` volume

Compose mounts a **named volume** for `/app/node_modules` so host bind-mounts do not break native modules. After adding npm packages:

```bash
docker compose run --rm --no-deps api npm ci
docker compose up api -d
```

If dependencies are still missing, remove only the deps volume (keeps Postgres/Redis data):

```bash
docker compose down api
docker volume rm sportykore-api_node_modules
docker compose run --rm --no-deps api npm ci
docker compose up api -d
```

Production Docker stages in `Dockerfile` are commented out; dev target is the supported path today.

---

## Environment variables

Validated in `start/env.ts`. Copy `.env.example` and fill in values.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `HOST`, `PORT` | HTTP bind (default `localhost:3333`) |
| `APP_KEY` | App secret — run `node ace generate:key` |
| `APP_URL` | Public app URL |
| `LOG_LEVEL` | Pino log level |
| `SESSION_DRIVER` | `cookie` \| `memory` \| `database` |
| `DB_CONNECTION` | `sqlite` (default) or `pg` (Docker) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | PostgreSQL when `DB_CONNECTION=pg` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth for mobile |
| `MOBILE_OAUTH_DEEP_LINK` | Optional redirect after Google login (e.g. `sportykore://auth/callback`) |
| `MOBILE_APP_URL` | Base URL for invite deep links in emails |
| `DRIVE_DISK` | Default drive disk (`s3` in schema) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | S3 + SES |
| `S3_BUCKET` | S3 bucket for uploads |
| `MAIL_MAILER` | `ses` |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Outbound email identity |

**Note:** League and team logo uploads in controllers use the local **`fs`** disk (`storage/`, served under `/uploads`) regardless of `DRIVE_DISK`. S3 is available for other drive usage via `FileService`.

---

## What is already built

### Domain model (database)

Migrations under `database/migrations/` define:

| Entity | Purpose |
| --- | --- |
| `users` | Accounts (web + API) |
| `auth_access_tokens` | Bearer tokens for mobile (`kpk_` prefix, 30-day expiry) |
| `password_resets` | Password reset tokens |
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
| **Mobile auth** | Bearer | Signup, login, logout, forgot/reset password, Google OAuth — see `MOBILE_AUTH_ROUTES.md` |
| **Manage hub** | Bearer | `GET /api/v1/auth/users/me`, owned leagues, teams, user search |
| **League owner** | Bearer + `leagueOwner` middleware | Update league; CRUD seasons, teams, games, stats, roster; generate invites |

`leagueOwner` resolves ownership from `leagueId` in params/body/query, or from the parent game/stat/league-player row.

### Web (Inertia)

- `/` — home
- `/login`, `/signup`, `/logout` — session auth
- Shared props: `user`, `flash` via `InertiaMiddleware`

### Background behaviour

- **Standings:** `UpdateStandings` listener recalculates standings when game scores change or stats are deleted.
- **Transmit:** broadcasts `game_updated` on channel `games/{id}` (config in `config/transmit.ts`; Redis backplane can be wired later).

### Not enabled / commented out

- `docker-compose` **worker** service (game worker) — stub only
- Production multi-stage **Dockerfile** target — commented
- `@adonisjs/mail` ace commands — commented in `adonisrc.ts` (provider is registered)

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
ROUTES.md          Full API route + payload reference
MOBILE_AUTH_ROUTES.md
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
| [ROUTES.md](ROUTES.md) | Every `/api/v1` route, auth requirements, request/response examples |
| [MOBILE_AUTH_ROUTES.md](MOBILE_AUTH_ROUTES.md) | Signup, login, OAuth, password reset |
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
- **League / team logos:** uploaded to **`fs`** disk → `storage/` directory, public URL under `/uploads/...`
- **Service:** `app/services/file_service.ts`
- Validators: `optionalImage()` in `app/validators/common.ts` (max 2 MB, jpg/png/webp)

Ensure `storage/` exists and is writable in local/Docker dev.

---

## Real-time updates

When game results or stats change, `GameUpdated` fires → `UpdateStandings` listener updates standings and broadcasts on Transmit channel `games/{gameId}`.

Subscribe from clients using [@adonisjs/transmit](https://docs.adonisjs.com/guides/realtime/transmit) conventions. Redis is available in Docker for a future Transmit backplane (`config/transmit.ts` currently uses in-memory transport).

---

## Development workflow

```bash
npm run dev          # Adonis + Vite HMR
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
