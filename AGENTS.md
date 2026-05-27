# AGENTS.md

## Project snapshot
- This is an AdonisJS 7 app with a React/Inertia frontend.
- HTTP boot flow starts in `bin/server.ts`, middleware is wired in `start/kernel.ts`, and routes live in `start/routes.ts`.
- Session auth is the only configured guard (`config/auth.ts`); route groups use named middleware from `start/kernel.ts` (`guest`, `auth`).

## Read these first
- Backend app flow: `start/routes.ts`, `app/controllers/*`, `app/middleware/*`.
- Shared UI data: `app/middleware/inertia_middleware.ts` and `app/transformers/user_transformer.ts`.
- Domain models: `app/models/*` with generated base classes from `database/schema.ts`.
- Validation rules: `app/validators/*`, especially `app/validators/common.ts` and `app/validators/user.ts`.
- Frontend entry: `inertia/app.tsx`, `inertia/layouts/default.tsx`, `inertia/pages/*`.

## Conventions that matter here
- Use the TS path aliases from `package.json` (`#models/*`, `#validators/*`, `#middleware/*`, `#transformers/*`, `#generated/*`).
- Prefer route names with Inertia helpers instead of hardcoded URLs; examples: `Link route="home"`, `Form route="session.store"` in `inertia/pages/auth/login.tsx`.
- Shared auth/user state is exposed through Inertia props, not manually fetched in pages (`children.props.user`, `children.props.flash`).
- Lucid models usually extend generated schema classes; e.g. `app/models/user.ts` extends `UserSchema` from `database/schema.ts`.
- Field naming is snake_case in migrations but camelCase in models/schema classes (`full_name` → `fullName`).
- VineJS date inputs are globally transformed to Luxon `DateTime` in `start/validator.ts`.

## Data / feature shape
- The core domain is sports/league management: `League`, `Season`, `Team`, `Player`, `Game`, `Stat`, `StatType`, and `LeaguePlayer`.
- Relationships are defined on models with Lucid decorators (`hasMany`, `belongsTo`, `hasOne`); check `app/models/league.ts` and `app/models/user.ts` for patterns.
- Validation helpers enforce DB-backed IDs and URL rules in `app/validators/common.ts`.

## Developer workflow
- Start local dev server: `npm run dev` (`node ace serve --hmr`).
- Production build: `npm run build`.
- Run tests: `npm test`.
- Type-check both backend and Inertia TS: `npm run typecheck`.
- Lint/format: `npm run lint`, `npm run format`.
- The dev Docker command runs migrations before serving; locally, run migrations with `node ace migration:run` when schema changes are present.

## Generated / do-not-edit-by-hand files
- Do not manually edit `database/schema.ts`; it is generated from migrations.
- Treat `.adonisjs/*` and generated client/server registries as build outputs.
- Regenerate generated artifacts through the Adonis commands/workflow instead of patching them directly.

## Time and timezone
- All instants are stored in UTC; clients display in the user locale.
- Match-day filtering (`GET /api/v1/leagues` → `matches`) uses `gameDate` + `timeZone` (IANA). See `docs/TIME_AND_TIMEZONE.md`.

## Integration points to preserve
- Inertia shared props come from `InertiaMiddleware.share()` and are consumed by the layout at `inertia/layouts/default.tsx`.
- Authentication flow uses `User.verifyCredentials(...)`, `auth.use('web').login(...)`, and `response.redirect().toRoute(...)` in `app/controllers/session_controller.ts`.
- API serialization is centralized through `providers/api_provider.ts` so responses stay wrapped in `{ data: ... }`.
- SQLite is the default database connection in `config/database.ts`, backed by `tmp/db.sqlite3`.

