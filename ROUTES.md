# API Routes

Scope: JSON API under `/api/v1` from `start/routes.ts`. Mobile authentication (OTP) lives under `/api/v1/auth` — see [Authentication](#authentication-otp) below. Legacy email/password routes are [deprecated](#deprecated-emailpassword--google-oauth).

## Response wrapping

- Endpoints that call `ctx.serialize(...)` return **`{ data: <payload> }`** (see `providers/api_provider.ts`).
- Endpoints that return `response.ok(...)` / `response.created(...)` directly return the JSON object **without** a `data` wrapper.

## Shared schemas

Types below reflect **transformer output** (`app/transformers/*`). Nullable DB fields may be `null`. Dates serialize as ISO 8601 strings.

### Primitives

| Shape | Fields |
| --- | --- |
| **Country** | `id` (number), `name` (string), `code` (string) |
| **League** | `id`, `name`, `logoUrl` (string \| null), `description`, `tiebreaker`, `startDate` (date \| null), `endDate` (date \| null), optional `games` → **Game[]** |
| **Team** | `id`, `name`, `logoUrl` (string \| null) |
| **Team (with admins)** | **Team** + `admins` → **TeamAdmin[]** (active only; `removed_at` null) |
| **TeamAdmin** | `id`, `teamId`, `userId`, `leagueId`, `user` → **User** |
| **Team (with games)** | **Team** + `homeGames`, `awayGames` → **Game[]** |
| **Player** | `id`, `name`, `avatarUrl` (string \| null), `visibility` (`active` \| `private`). **If `visibility: private`, every variant below collapses to just `{ id, name, visibility: "private" }`** — see [docs/PLAYER_PROFILE.md](docs/PLAYER_PROFILE.md) |
| **Player (with stats)** | **Player** + `stats` → **Stat[]** |
| **Player (profile)** | **Player** + `bio`, `primaryPosition`, `secondaryPosition`, `preferredFoot`, `heightCm`, `city`, `state`, `nationality`, `socialHandle`, `age` (number \| null, computed — **`dateOfBirth` is never serialized**), `country` → **Country** \| omitted, `highlights` → **PlayerHighlight[]** \| omitted |
| **PlayerHighlight** | `id`, `videoId` (11-char YouTube ID), `title` (string \| null), `sortOrder`, `thumbnailUrl` (derived: `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`) |
| **StatType** | `id`, `name`, `displayName`, `iconName` (string \| null), `category` (string \| null) |
| **Stat** | `id`, `minute` (number \| null), `isStoppageTime` (boolean \| null), `numericValue` (number \| null), `clientEventId` (string \| null), `qualifiers` (object), `isUnaccredited` (boolean), `type` → **StatType** \| omitted, `team` → **Team** \| omitted, `player` → **Player** \| omitted, `relatedPlayer` → **Player** \| omitted |
| **Standing** | `id`, `position`, `played`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`, `goalDifference`, `points`, `form` (string \| null), `team` → **Team** \| omitted |
| **Game** | `id`, `status`, `playedAt`, `homeScore`, `awayScore`, `venueName`, `venueId`, `venue` → **Venue (for game)** \| omitted, `currentMinute`, `stageId`, `tieId`, `leg`, `round`, `bracketPosition`, `homePenaltyScore`, `awayPenaltyScore`, `homeTeam` → **Team** \| omitted, `awayTeam` → **Team** \| omitted, `winnerTeam` → **Team** \| omitted |
| **Game (detail)** | **Game** + `league` → **League** \| omitted, `stats` → **Stat[]**, `tracking` → derived possession/pass/shot metrics, `lineups` → **TeamLineupGroup[]** |
| **Stage** | `id`, `seasonId`, `name`, `stageType` (`round_robin` \| `group` \| `knockout` \| `playoff`), `sequence`, `status` (`upcoming` \| `active` \| `completed`), `sourceStageId`, `config` (object) |
| **Tie** | `id`, `stageId`, `round`, `bracketPosition`, `tieFormat`, `bestOf`, `targetWins`, `awayGoals`, `isBye`, `homeScoreAgg`, `awayScoreAgg`, `status`, `homeTeam` → **Team** \| omitted, `awayTeam` → **Team** \| omitted, `winnerTeam` → **Team** \| omitted, `games` → **Game[]** \| omitted |
| **Venue** | `id`, `name`, `address`, `latitude`, `longitude`, `googlePlaceId`, `capacity`, `city`, `notes` (coords number \| null) |
| **Venue (for game)** | `id`, `name`, `address`, `latitude`, `longitude`, `capacity` |
| **Formation** | `id`, `name`, `displayName`, `isActive`, `slots` → array of `{ key, position, line, order, label }` |
| **GameLineup** | `id`, `gameId`, `teamId`, `playerId`, `formationId`, `slotKey`, `status`, `position`, `jerseyNumber`, `startingOrder`, `subbedInMinute`, `subbedOutMinute`, nested `player` → **Player**, `team` → **Team**, `formation` → **Formation** |
| **TeamLineupGroup** | `team` → **Team**, `formation` → **Formation** \| null, `starters` → **GameLineup[]**, `substitutes` → **GameLineup[]** |
| **Season** | `id`, `name`, `status`, optional nested: `league`, `stages` → **Stage[]**, `games`, `standings`, `stats` |
| **SearchHit** | `id` (string), `type` (`country` \| `league` \| `team` \| `player`), `label`, optional `sublabel`, optional `countryCode`, optional `logoUrl` (string \| null; set for `league` and `team` hits from `leagues.logo_url` / `teams.logo_url`, `null` for `country` and `player`) |
| **LeaguePlayer** | `id`, `status`, `position`, `jerseyNumber`, `isCaptain` |
| **LeaguePlayer (with league)** | **LeaguePlayer** + `league` → **League**, `team` → **Team** |
| **LeaguePlayer (with player)** | **LeaguePlayer** + `player` → **Player**, `team` → **Team** |
| **OwnedLeague** | `id`, `name`, `logoUrl`, `countryId`, `startDate`, `endDate`, `activeSeason` → **Season** \| null, `role` (`owner`) |
| **AdminTeamManaged** | `id`, `name`, `logoUrl`, `league` → `{ id, name, logoUrl, startDate, endDate }`, `activeSeason` → **Season** \| null, `role` (`team_admin`) |
| **User** | `id`, `email`, `fullName` |
| **AuthSession** | `auth.user` → **User**; `auth.token` → `{ type: 'bearer', value, expiresAt, abilities }` |

### Game `status` values

`scheduled` \| `first_half` \| `half_time` \| `second_half` \| `extra_time` \| `penalty_shootout` \| `full_time` \| `cancelled` \| `postponed` \| `paused`

- **`currentMinute`** in API responses is **computed** from period start timestamps (`firstHalfStartedAt`, etc.) — not polled/stored every minute. See [docs/CHANGE_GAME.md](docs/CHANGE_GAME.md).
- **`penalty_shootout`** is a live status (Match Center clock group). Enter via `POST /games/:gameId/penalty-shootout`; complete with scores via `…/penalty-shootout/complete`. See [docs/KNOCKOUT.md](docs/KNOCKOUT.md).
- Query param **`gameStatus=live`** on `GET /api/v1/leagues` matches any in-play status (`first_half`, `second_half`, `extra_time`, `paused`).

### Season `status` values

`inactive` \| `active` \| `completed`

### Roster `status` values (league_players)

`active` \| `transferred` \| `injured` \| `suspended`

### Roster `position` values (league_players, nullable)

`attack` \| `defence` \| `midfield` \| `goalkeeper`

### Stat type `name` values (seeded)

Includes `goals`, `own_goal`, `assists`, `pass`, `shot`, `yellow_card`, `red_card`, `saves`, `shots_on_target`, `fouls_conceded`, `substitution_on`, `substitution_off`.

`substitution_on` / `substitution_off` are the **historical match-event record** for substitutions (timeline). See [Substitutions (via stats)](#substitutions-via-stats).

---

## Authentication (OTP)

Mobile sign-in and sign-up use **one-time passwords** emailed to the user. There is no password field. Controller: `app/controllers/auth_controller.ts`; service: `app/services/otp_service.ts`.

### Flow

One endpoint handles both login and signup: **`POST /api/v1/auth/request-otp`**.

1. User submits `email` (and optionally `name`, `recoveryEmail`).
2. **Returning user** (email exists in `users`) → `200` `{ message: "OTP sent" }`.
3. **New user, `name` missing** → `428` `{ message: "...", requiresSignup: true }`. App shows name / recovery email form and retries the same endpoint.
4. **New user, `name` provided** → user row created, then `200` `{ message: "OTP sent" }`.
5. User enters `code` → **`POST /api/v1/auth/verify-otp`** with `email` and `code` → Bearer token. Welcome email on first signup.

**After auth**

Use **`Authorization: Bearer <token>`** on protected routes (`apiAuth` guard). Token name `mobile`, **`expiresIn: 30d`**.

Account recovery: if the user set a `recovery_email`, **`POST /api/v1/auth/recover`** looks up the account and sends an OTP to the **primary** email.

### Auth routes

| Method | Path | Auth | Input | Success response | Errors / notes |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/request-otp` | none | **Body:** `requestOtpValidator` — `email`, `name?`, `recoveryEmail?` | `200` → `{ message: "OTP sent" }` (not wrapped in `data`) | `428` new user missing `name` → `{ message, requiresSignup: true }`; `422` validation (e.g. duplicate `recoveryEmail`); rate limit: 5 / 10 min per email, 30 min block; `429` when exceeded |
| `POST` | `/api/v1/auth/verify-otp` | none | **Body:** `verifyOtpValidator` — `email`, `code` (exactly 6 chars) | **`{ data: { auth: AuthSession } }`** | `422` validation; invalid/expired code → `401`; rate limit: 5 attempts / 10 min per email; welcome email on first signup |
| `POST` | `/api/v1/auth/recover` | none | **Body:** `requestRecoveryValidator` — `recoveryEmail` (must exist in `users.recovery_email`) | `{ message: "Recovery OTP sent to your primary email" }` | `404` if no user with that recovery email; same rate limit as `request-otp` |
| `POST` | `/api/v1/auth/logout` | `apiAuth` | Bearer token | `204 No Content` | Invalidates current API token; `401` without token |
| `DELETE` | `/api/v1/auth/account` | `apiAuth` | Bearer token | `{ message: "Account deleted successfully" }` | Deletes player profile, OTP codes, tokens, and user row; `401` without token |

### `verify-otp` success payload

```json
{
  "data": {
    "auth": {
      "user": { "id": 1, "email": "player@example.com", "fullName": "Ada Player" },
      "token": {
        "type": "bearer",
        "value": "kpk_…",
        "expiresAt": "2026-07-14T12:00:00.000Z",
        "abilities": ["*"]
      }
    }
  }
}
```

---

## Deprecated: email/password & Google OAuth

> **Deprecated** — routes are **commented out** in `start/routes.ts` and are **not registered**. Kept for reference and migration from older clients. Use [OTP authentication](#authentication-otp) instead.

Implementation (inactive): `app/controllers/users_controller.ts`. Former detail also in `MOBILE_AUTH_ROUTES.md`.

| Method | Path | Input | Former success response | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | `fullName?`, `email`, `password`, `passwordConfirmation` | `201` → `{ data: { auth: AuthSession } }` | Password hashed on user row |
| `POST` | `/api/v1/auth/login` | `email`, `password` | `200` → `{ data: { auth: AuthSession } }` | `401` invalid credentials |
| `POST` | `/api/v1/auth/forgot-password` | `email` | `204 No Content` | Emailed reset token |
| `POST` | `/api/v1/auth/reset-password` | `token`, `password`, `passwordConfirmation` | `204 No Content` | `400` invalid/expired token |
| `GET` | `/api/v1/auth/google/redirect` | none | Redirect to Google OAuth | Ally |
| `GET` | `/api/v1/auth/google/callback` | Google callback query | `302` to `MOBILE_OAUTH_DEEP_LINK` or `200` with `{ data: { auth } }` | Token name `google-mobile`, 30d |
| `POST` | `/api/v1/auth/logout` | Bearer | `204` | Replaced by OTP `AuthController.logout` (same path, still active) |

---

## Auth / users (manage hub)

All routes require `apiAuth` (Bearer token). Responses use `{ data: ... }` unless noted.

### Breaking change: `GET /auth/users/leagues` → `GET /auth/users/managed`

**`GET /api/v1/auth/users/leagues` has been removed** (no redirect / alias). Clients that still call it will get `404`.

| Old | New |
| --- | --- |
| `GET /api/v1/auth/users/leagues` | `GET /api/v1/auth/users/managed` |
| `{ data: OwnedLeague[] }` (owned leagues only) | `{ data: { ownedLeagues, adminTeams } }` |

**Client migration:**

1. Switch the manage-home fetch to `GET /api/v1/auth/users/managed`.
2. Read owned leagues from `data.ownedLeagues` (same fields as before, plus `role: "owner"`).
3. Optionally render `data.adminTeams` for team-admin entry points (deep-link via `league` + `activeSeason`).
4. Do **not** treat `data` as a bare array anymore.

`GET /api/v1/auth/users/leagues/:leagueId/teams` is **unchanged** (owner-only teams-with-admins list). Only the list endpoint path/shape changed.

### Capability matrix

| Action | League owner | Team admin |
| --- | --- | --- |
| Manage hub list (`GET /managed`) | yes | yes (their teams under `adminTeams`) |
| League tabs (games / players / settings) | yes | no (`403`) |
| Edit team name / logo | yes | no |
| Set lineup for their team | yes | yes |
| Match Center clock / score / accredit / subs / stats writes | yes | no |
| Assign / remove team admins | yes | no |
| Invite / roster edits | yes | no |

**Team-admin read (v1):** no dedicated admin read API. Use public `GET /api/v1/teams/:id` (seasons → games + roster) and `GET /api/v1/games/:gameId/lineups`. Deep-link season from `adminTeams[].activeSeason` on `/managed`.

| Method | Path | Input | Success response | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/auth/users/me` | none | **`{ data: User }`** — `id`, `email`, `fullName` | Logged-in check |
| `GET` | `/api/v1/auth/users/managed` | none | **`{ data: { ownedLeagues, adminTeams } }`** | Replaces removed `GET .../leagues` — see migration note above |
| `GET` | `/api/v1/auth/users/leagues/:leagueId/teams` | **Params:** `leagueId` | **`{ data: Team (with admins)[] }`** | `403` if not league owner; `admins` lists active team admins with nested `user` for assign/remove UI |
| `GET` | `/api/v1/auth/users/search` | **Query:** `q`, `leagueId` (required), `limit?` (1–50, default 20) | **`{ data: User[] }`** | Flow A user picker; `403` if not owner |

### `GET /api/v1/auth/users/managed` → `{ ownedLeagues, adminTeams }`

- **`ownedLeagues`**: leagues where `user_id` = auth user; each includes `role: "owner"` and `activeSeason`.
- **`adminTeams`**: teams where the user has an active `team_admins` row (`removed_at` null). Excludes teams in leagues the user already owns (no duplicate). Each includes nested `league`, `activeSeason`, and `role: "team_admin"`.

```json
{
  "data": {
    "ownedLeagues": [
      {
        "id": 10,
        "name": "Sunday Riverside League",
        "logoUrl": null,
        "countryId": 1,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "activeSeason": { "id": 5, "name": "2026", "status": "active" },
        "role": "owner"
      }
    ],
    "adminTeams": [
      {
        "id": 16,
        "name": "Burkina Faso City 2",
        "logoUrl": "...",
        "league": {
          "id": 10,
          "name": "Sunday Riverside League",
          "logoUrl": null,
          "startDate": "2026-01-01",
          "endDate": "2026-12-31"
        },
        "activeSeason": { "id": 5, "name": "2026", "status": "active" },
        "role": "team_admin"
      }
    ]
  }
}
```

### `GET /api/v1/auth/users/leagues/:leagueId/teams` → `Team (with admins)[]`

League owner only. Each team includes active admins (`removed_at` null) so the manage UI can call `DELETE /api/v1/leagues/:leagueId/teams/:teamId/admins/:userId` without a separate list endpoint.

```json
{
  "data": [
    {
      "id": 1,
      "name": "Riverside United",
      "logoUrl": "https://api.dicebear.com/9.x/icons/svg?seed=Riverside%20United",
      "admins": [
        {
          "id": 5,
          "teamId": 1,
          "userId": 42,
          "leagueId": 10,
          "user": { "id": 42, "email": "admin@example.com", "fullName": "Jane Admin" }
        }
      ]
    }
  ]
}
```

---

## Routes

| Method | Path | Auth | Input | Success response | Errors / notes |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/v1/countries` | none | none | **`{ data: CountryRef[] }`** — `id`, `name`, `code` only | Always `200` |
| `GET` | `/api/v1/countries/:idOrCode` | none | **Params:** numeric `id` (e.g. `1`) or ISO country `code` (e.g. `ng`) | **`{ data: CountryDetail }`** — see below | `404` country not found |
| `GET` | `/api/v1/leagues` | none | **Query:** `countryId?`, `gameStatus?`, `gameDate?` (`YYYY-MM-DD`, default today in resolved timezone), `timeZone?` (IANA, e.g. `Africa/Lagos`; falls back to `Time-Zone` / `X-Timezone` request header; default `UTC`). Response includes `matchDay: { gameDate, timeZone }` echoing the filter applied to `matches`. `matches` filters `played_at` to that **local calendar day** converted to UTC. See [docs/TIME_AND_TIMEZONE.md](docs/TIME_AND_TIMEZONE.md). | **`{ data: { matchDay, leagues, matches } }`** — `leagues` unfiltered list; `matches` game feed | `400` invalid `gameDate` / `timeZone`; empty `matches` if no games that day |
| `GET` | `/api/v1/leagues/:leagueId` | none | **Params:** `leagueId`. **Query:** `seasonId?` (positive integer; defaults to the league's `active` season, else the newest) | **`{ data: { seasons, season, statTypes } }`** — see below | `400` invalid `leagueId` or `seasonId`; `404` league/season not found |
| `POST` | `/api/v1/leagues` | `apiAuth` | **Body:** `createLeagueWithSeasonValidator` — see below | **`201`** `{ message, leagueId, seasonId, stageId, format, seeded }` | Validation `422`; creates league + active season + stage by `format` (`league` → round_robin, `knockout` → knockout, `group` → group stage). Group create does not assign/fixtures (`seeded: false`). See [docs/KNOCKOUT.md](docs/KNOCKOUT.md), [docs/GROUPS.md](docs/GROUPS.md) |
| `POST` | `/api/v1/leagues/:leagueId/favorite` | `apiAuth` | **Params:** `leagueId` (positive integer; must exist in `leagues`). No body. | `{ message: "League added to favorites" }` | `401` unauthorized; `409` already favourited; `422` invalid or missing league |
| `DELETE` | `/api/v1/leagues/:leagueId/favorite` | `apiAuth` | **Params:** `leagueId` (positive integer; must exist in `leagues`). No body. | `{ message: "League removed from favorites" }` | `401` unauthorized; `422` invalid or missing league; idempotent if not favourited |
| `PUT` | `/api/v1/leagues/:leagueId` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `updateLeagueValidator` | `{ message: "League updated successfully" }` | `400` invalid id; `403` not owner; `404` league |
| `GET` | `/api/v1/search` | none | **Query:** `q` (string, trimmed; empty → no search), `limit?` (number 1–100, default 24) | **`{ data: { query: string, results: SearchHit[] } }`** | Always `200`; empty `q` → `results: []` |
| `GET` | `/api/v1/support/faqs` | none | none | **`{ data: { articles } }`** | Reads published rows from the Google Sheets `faq` tab |
| `POST` | `/api/v1/support/bug-reports` | optional Bearer | **Body:** `bugReportValidator` | **201** `{ message, report }` | Appends to the Google Sheets `bugs` tab; token is used only to attach `user_id` when valid |
| `POST` | `/api/v1/support/faqs/seed` | `apiAuth` | Header `x-support-seed-token` in production | `{ inserted, skipped }` | Appends bundled FAQs that are not already in the Sheet |
| `GET` | `/api/v1/games/:id` | none | **Params:** `id` (game id) | **`{ data: GameDetail }`** | `404` if game missing |
| `GET` | `/api/v1/formations` | none | none | **`{ data: Formation[] }`** | Active formations only, ordered by `name` |
| `GET` | `/api/v1/formations/:id` | none | **Params:** `id` (formation id) | **`{ data: Formation }`** | `404` if formation missing |
| `GET` | `/api/v1/games/:gameId/lineups` | none | **Params:** `gameId` | **`{ data: TeamLineupGroup[] }`** | Grouped by team; empty array if no lineups |
| `GET` | `/api/v1/leagues/stages/:id/bracket` | none | **Params:** `id` (stage id) | **`{ data: { stage: Stage, ties: Tie[] } }`** | Knockout bracket; ties nested with teams + games. See [docs/KNOCKOUT.md](docs/KNOCKOUT.md) |
| `GET` | `/api/v1/leagues/stages/:id/standings` | none | **Params:** `id` (stage id) | **`{ data: { stage, tables[] } }`** — per-group or single RR table with adjustments/overrides/zones | `422` if knockout/playoff. See [docs/GROUPS.md](docs/GROUPS.md) |
| `GET` | `/api/v1/seasons/:seasonId/stages` | none | **Params:** `seasonId` | **`{ data: Stage[] }`** | Ordered by `sequence`, then `id` |
| `GET` | `/api/v1/teams/:id` | none | **Params:** `id` (team id) | **`{ data: { team, leagues, statTypes } }`** — see below | `404` if team missing |
| `GET` | `/api/v1/players/:id` | none | **Params:** `id` (player id) | **`{ data: { player, leagues, statTypes } }`** — see below | `404` if player missing; stubbed if `visibility: private` (empty `leagues`/`statTypes`) |
| `GET` | `/api/v1/players/does-user-have-player-profile` | `apiAuth` | none | `{ hasPlayerProfile: boolean, playerId: number }` (not wrapped in `data`) | `401` without Bearer token; checks whether the authenticated user has a `players` row |
| `GET` | `/api/v1/me/player` | `apiAuth` | none | **200** `{ data: { player, completeness, missingFields, highlightsCount, membership } }` — see below | **404** `{ message }` if the user has no player profile — this is the "no profile" signal for the app CTA. See [docs/PLAYER_PROFILE.md](docs/PLAYER_PROFILE.md) |
| `POST` | `/api/v1/me/player` | `apiAuth` | **Body:** `createPlayerProfileValidator` | **201** `{ data: { player } }` (**Player (profile)**) | `409` if the user already has a profile; `422` validation |
| `PUT` | `/api/v1/me/player` | `apiAuth` | **Body:** `updatePlayerProfileValidator` | `{ data: { player } }` | `404` if no profile yet; `422` validation |
| `POST` | `/api/v1/me/player/photo` | `apiAuth` | **Body:** `multipart/form-data` — `photo` (image, max 2 MB, jpg/jpeg/png/webp) | `{ data: { player } }` | `404` if no profile yet; uploads via the existing S3 drive pipeline (`players/` prefix) |
| `GET` | `/api/v1/me/player/highlights` | `apiAuth` | none | **`{ data: PlayerHighlight[] }`**, ordered by `sortOrder` | `404` if no profile yet |
| `POST` | `/api/v1/me/player/highlights` | `apiAuth` | **Body:** `createHighlightValidator` (`url`, optional `title`) | **201** `{ data: PlayerHighlight }` | `422` non-YouTube URL or 11th highlight; `409` duplicate video on this profile. See [docs/PLAYER_PROFILE.md](docs/PLAYER_PROFILE.md) |
| `PUT` | `/api/v1/me/player/highlights/reorder` | `apiAuth` | **Body:** `reorderHighlightsValidator` (`ids: number[]`) | `{ data: PlayerHighlight[] }` in the new order | `422` if `ids` isn't exactly the caller's highlight IDs, once each |
| `PUT` | `/api/v1/me/player/highlights/:hid` | `apiAuth` | **Params:** `hid`. **Body:** `updateHighlightValidator` (`title`) | `{ data: PlayerHighlight }` | `404` if not the caller's own highlight |
| `DELETE` | `/api/v1/me/player/highlights/:hid` | `apiAuth` | **Params:** `hid` | `{ message: "Highlight removed successfully" }` | `404` if not the caller's own highlight |
| `GET` | `/api/v1/invites/generate` | `apiAuth` + `leagueOwner` | **Query:** `leagueId`, `seasonId`, `teamId`, `invitedUserId?` | `{ inviteLink: string }` (not wrapped in `data`) | See [docs/PLAYER_INVITE.md](docs/PLAYER_INVITE.md) |
| `GET` | `/api/v1/invites/accept/:token` | `apiAuth` | **Params:** `token` | If no player profile: `{ requiresProfile: true, token: string }`. Else: `{ requiresProfile: false, leagueId: number \| null }` | `401` without Bearer token; `403` wrong user; `409` already on roster; `404` invalid/expired invite |
| `POST` | `/api/v1/invites/complete-profile-and-accept/:token` | `apiAuth` | **Params:** `token`. **Body:** `multipart/form-data` or JSON — `name` (string, required), `countryId` (required FK to `countries`), `bio?` (string, optional), `avatar?` (image file, max 2 MB, jpg/jpeg/png/webp) | `{ leagueId: number \| null }` | `409` if player profile already exists; `422` validation |
| `GET` | `/api/v1/leagues/league-player-requests` | `apiAuth` | none | **LeaguePlayerWithLeague[]** (not wrapped in `data`) | Lists `league_players` where `player_id = auth user id` and `status = pending` |
| `POST` | `/api/v1/leagues/accept-league-player-request` | `apiAuth` | **Body:** `acceptLeaguePlayerRequestValidator` | `{ message: "League player request accepted successfully" }` | `404` row missing; `409` already active |
| `POST` | `/api/v1/leagues/:leagueId/seasons` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `createSeasonValidator` | **`201`** `{ id, leagueId, name, status, createdAt, updatedAt, stageId, format, seeded }` | Validation `422`; `format` defaults to `league`; knockout/group seasons are not auto-seeded; setting `status: active` completes other active seasons in the same league |
| `PUT` | `/api/v1/leagues/:leagueId/seasons/:seasonId` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `seasonId`. **Body:** `updateSeasonValidator` | `{ message: "Season updated successfully" }` | `404` season not in league; setting `status` to `active` completes other active seasons in the same league |
| `POST` | `/api/v1/leagues/:leagueId/teams` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `createTeamValidator` | **`201`** `{ message: "Team created successfully" }` | Logo uploaded to drive when provided |
| `PUT` | `/api/v1/leagues/:leagueId/teams/:id` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `id` (team id). **Body:** `updateTeamValidator` | `{ message: "Team updated successfully" }` | `404` team |
| `DELETE` | `/api/v1/leagues/:leagueId/teams/:id` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `id` (team id) | `{ message: "Team deleted successfully" }` | `404` if team missing or not in league; cascades related games, standings, roster rows, stats, invites |
| `POST` | `/api/v1/leagues/:leagueId/teams/:teamId/admins` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `teamId`. **Body:** `assignTeamAdminValidator` | **`201`** `{ message: "Team admin assigned successfully" }` | `404` team not in league; `409` user already an active admin; reactivates if previously removed; emails the assignee on success |
| `DELETE` | `/api/v1/leagues/:leagueId/teams/:teamId/admins/:userId` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `teamId`, `userId` | `{ message: "Team admin removed successfully" }` | `404` if no active admin row; sets `removed_at` (soft remove) |
| `GET` | `/api/v1/leagues/:leagueId/venues` | `apiAuth` + `leagueOwner` | **Params:** `leagueId` | **`{ data: Venue[] }`** | League-scoped venue list; see [docs/VENUES.md](docs/VENUES.md) |
| `POST` | `/api/v1/leagues/:leagueId/venues` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `createVenueValidator` | **`201`** `{ message: "Venue created successfully" }` | Sets `createdBy` from auth |
| `PUT` | `/api/v1/leagues/venues/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (venue id). **Body:** `updateVenueValidator` | `{ message: "Venue updated successfully" }` | Ownership via venue → league |
| `DELETE` | `/api/v1/leagues/venues/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (venue id) | `{ message: "Venue deleted successfully" }` | Games keep `venueName`; `venue_id` SET NULL |
| `POST` | `/api/v1/leagues/assign-team` | `apiAuth` + `leagueOwner` | **Body:** `createLeaguePlayerValidator` | `{ message: "Player assigned to team successfully" }` or `"...Invited to join team successfully"` if `status` ≠ `active` | Upserts `league_players` by player + league + season |
| `GET` | `/api/v1/leagues/:leagueId/seasons/:seasonId/roster` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `seasonId` | **`{ data: LeaguePlayerWithPlayer[] }`** | Season roster for manage Players tab |
| `PUT` | `/api/v1/leagues/league-players/:id` | `apiAuth` + `leagueOwner` | **Params:** `id`. **Body:** `updateLeaguePlayerValidator` | `{ message: "League player updated successfully" }` | |
| `DELETE` | `/api/v1/leagues/league-players/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` | `{ message: "League player removed successfully" }` | |
| `POST` | `/api/v1/leagues/:leagueId/stages` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** knockout (`createKnockoutStageValidator`) or `stageType: "group"` + `createGroupStageValidator` | **`201`** `{ message, id }` (+ `groups` for group) | Creates knockout or group stage; see [docs/KNOCKOUT.md](docs/KNOCKOUT.md), [docs/GROUPS.md](docs/GROUPS.md) |
| `POST` | `/api/v1/leagues/stages/:id/seed` | `apiAuth` + `leagueOwner` | **Params:** `id` (stage id). **Body:** `seedKnockoutStageValidator` | `{ message: "Knockout phase generated successfully" }` | Ownership via stage → season → league; `409` if already seeded |
| `POST` | `/api/v1/leagues/stages/:id/next-round` | `apiAuth` + `leagueOwner` | **Params:** `id` (stage id). **Body:** `nextRoundValidator` | `{ message: "Next round generated successfully" }` | Idempotent if next round already exists; SF may also create `third_place` |
| `POST` | `/api/v1/leagues/stages/:id/groups/assign` | `apiAuth` + `leagueOwner` | **Body:** `assignGroupTeamsValidator` (`mode: manual\|auto`) | `{ message, assignments }` | `409` if already assigned. See [docs/GROUPS.md](docs/GROUPS.md) |
| `POST` | `/api/v1/leagues/stages/:id/fixtures` | `apiAuth` + `leagueOwner` | none | `{ message, count }` | Circle-method RR; `409` if fixtures exist |
| `GET` | `/api/v1/leagues/stages/:id/qualifiers` | `apiAuth` + `leagueOwner` | **Query:** `dryRun?`, `targetRound?`, `thirdsMode?`, `selectedThirds?`, `force?` | **`{ data: ResolveQualifiersResult }`** | Preview with `dryRun=true`. See [docs/GROUPS.md](docs/GROUPS.md) |
| `POST` | `/api/v1/leagues/stages/:id/generate-knockout` | `apiAuth` + `leagueOwner` | **Body:** `generateKnockoutFromGroupValidator` | **`201`** `{ stage, ties, qualifiers }` | Creates knockout + calls existing `generateKnockoutPhase`; marks group completed |
| `GET` | `/api/v1/leagues/stages/:id/standings/adjustments` | `apiAuth` + `leagueOwner` | **Params:** `id` (stage id) | **`{ data: Adjustment[] }`** | Point deductions/bonuses |
| `POST` | `/api/v1/leagues/stages/:id/standings/adjustments` | `apiAuth` + `leagueOwner` | **Body:** `createStandingAdjustmentValidator` | **`201`** Adjustment | Non-zero delta −50..50; reason required |
| `PUT` | `/api/v1/leagues/stages/adjustments/:aid` | `apiAuth` + `leagueOwner` | **Body:** `updateStandingAdjustmentValidator` | Adjustment | Ownership via adjustment → stage → season → league |
| `DELETE` | `/api/v1/leagues/stages/adjustments/:aid` | `apiAuth` + `leagueOwner` | **Params:** `aid` | `{ message }` | |
| `POST` | `/api/v1/leagues/stages/:id/standings/overrides` | `apiAuth` + `leagueOwner` | **Body:** `createStandingOverrideValidator` | **`201`** `{ overrides }` | Full tied cohort ranks 1..N |
| `DELETE` | `/api/v1/leagues/stages/:id/standings/overrides/:oid` | `apiAuth` + `leagueOwner` | **Params:** `id`, `oid` | `{ message }` | |
| `GET` | `/api/v1/leagues/stages/:id/zones` | `apiAuth` + `leagueOwner` | **Params:** `id` | **`{ data: Zone[] }`** | Standing zones |
| `POST` | `/api/v1/leagues/stages/:id/zones` | `apiAuth` + `leagueOwner` | **Body:** `createStandingZoneValidator` | **`201`** Zone | |
| `PUT` | `/api/v1/leagues/stages/zones/:zid` | `apiAuth` + `leagueOwner` | **Body:** `updateStandingZoneValidator` | Zone | Ownership via zone → stage → season → league |
| `DELETE` | `/api/v1/leagues/stages/zones/:zid` | `apiAuth` + `leagueOwner` | **Params:** `zid` | `{ message }` | |
| `GET` | `/api/v1/leagues/:leagueId/audit-logs` | `apiAuth` + `leagueOwner` | **Query:** `page?`, `perPage?` | **`{ data: { data, meta } }`** | Append-only admin audit history |
| `POST` | `/api/v1/leagues/games` | `apiAuth` + `leagueOwner` | **Body:** `createGameValidator` | **`201`** `{ message: "Game created successfully" }` | Auto-attaches `stage_id` to the season’s `round_robin` stage (ensures one if missing). Optional `venueId` snapshots into `venueName`. Knockout games are **not** created here — use stage seed / next-round. See [docs/VENUES.md](docs/VENUES.md), [docs/KNOCKOUT.md](docs/KNOCKOUT.md) |
| `PUT` | `/api/v1/leagues/games/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (game id). **Body:** `updateGameValidator` | `{ message: "Game updated successfully" }` | `404` game; client updates scores here (not via stats); same `venueId` / `venueName` rules as create |
| `DELETE` | `/api/v1/leagues/games/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (game id) | `{ message: "Game deleted successfully" }` | Cascades stats |
| `POST` | `/api/v1/leagues/stats` | `apiAuth` + `leagueOwner` | **Body:** `createStatValidator` | **`201`** `{ message: "Stat created successfully" }` | Validates player on active roster + correct team side; does **not** auto-update game score. Use for goals, cards, etc. |
| `POST` | `/api/v1/leagues/stats/substitutions` | `apiAuth` + `leagueOwner` | **Body:** `recordSubstitutionValidator` | **`201`** `{ message, statIds: number[] }` | Atomically creates paired `substitution_off` + `substitution_on` rows per swap (see below) |
| `POST` | `/api/v1/games/:gameId/tracking-events` | `apiAuth` + `leagueOwner` | **Body:** `recordTrackingEventsValidator` | **`201`** `{ message, accepted, skipped }` | Batch ingest for `pass` and `shot` stats. Dedupe uses `clientEventId`; players must be in the submitted lineup when that team has one, or on the active roster when no lineup has been submitted for that team |
| `PUT` | `/api/v1/leagues/stats/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (stat id). **Body:** `updateStatValidator` | `{ message: "Stat updated successfully" }` | `404` stat; cannot change `playerId` / `statTypeId` — delete + recreate to change who was involved |
| `DELETE` | `/api/v1/leagues/stats/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (stat id) | `{ message: "Stat deleted successfully" }` | Recalculates standings / broadcasts game update |

### Substitutions (via stats)

Match substitutions are **events** stored in `stats`, not lineup mutations. Auth: `apiAuth` + `leagueOwner`. Prefer the atomic endpoint below; generic `POST /leagues/stats` still works for one row at a time.

#### Preferred: `POST /api/v1/leagues/stats/substitutions`

Creates paired `substitution_off` + `substitution_on` rows in **one transaction** (resolves stat type IDs server-side). Supports one or many swaps in a single request.

| Field | Rules |
| --- | --- |
| `gameId`, `leagueId`, `seasonId`, `teamId` | required FKs; team must be home/away in the game |
| `substitutions` | array min 1 max 11 of `{ playerOffId, playerOnId, minute, isStoppageTime? }` |
| per swap | `playerOffId` ≠ `playerOnId`; both on active roster; **off must be a starter** and **on must be a bench substitute** in `game_lineups` for that game/team; each player at most once in the batch |

Example:

```json
{
  "gameId": 1,
  "leagueId": 10,
  "seasonId": 5,
  "teamId": 1,
  "substitutions": [
    { "playerOffId": 10, "playerOnId": 20, "minute": 60 },
    { "playerOffId": 11, "playerOnId": 21, "minute": 60 }
  ]
}
```

Success: `{ "message": "Substitution(s) recorded successfully", "statIds": [101, 102, 103, 104] }` (off/on pairs in order).

Per swap the server writes:

| Stat type | `playerId` | `relatedPlayerId` |
| --- | --- | --- |
| `substitution_off` | player leaving | player coming on |
| `substitution_on` | player coming on | player leaving |

- **Edit players / undo a swap:** `DELETE` both paired rows, then `POST .../substitutions` again (or recreate via two generic stats POSTs). `PUT /leagues/stats/:id` can only patch `minute`, `relatedPlayerId`, etc. — not `playerId`.
- **UI:** show “Player A substituted by Player B at 60'” from these stats; keep `game_lineups` for pitch display (starters / bench) only.

### Live game time (`apiAuth` + `leagueOwner`)

League owner only may control match clock. Each action broadcasts SSE `status_changed` on channel `games/{gameId}`. See [docs/CHANGE_GAME.md](docs/CHANGE_GAME.md).

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/games/:gameId/start-first-half` | none | `{ message: "First half started" }` | From `scheduled` or `postponed`; sets `firstHalfStartedAt` |
| `POST` | `/api/v1/games/:gameId/half-time` | none | `{ message: "Half time" }` | From `first_half` |
| `POST` | `/api/v1/games/:gameId/start-second-half` | none | `{ message: "Second half started" }` | From `half_time`; sets `secondHalfStartedAt` |
| `POST` | `/api/v1/games/:gameId/extra-time` | none | `{ message: "Extra time started" }` | From `second_half`; sets `extraTimeStartedAt` |
| `POST` | `/api/v1/games/:gameId/pause` | none | `{ message: "Game paused" }` | From `first_half`, `second_half`, or `extra_time`; stores `pausedAt` + `pausedFromStatus` |
| `POST` | `/api/v1/games/:gameId/resume` | none | `{ message: "Game resumed" }` | From `paused`; shifts period start timestamp by pause duration |
| `POST` | `/api/v1/games/:gameId/full-time` | `{ homeScore, awayScore }` (required) | `{ message: "Full time" }` | From `second_half`, `extra_time`, or `penalty_shootout`; sets `winnerTeamId` from score/pens; if `tieId` set, runs `advanceTie` (knockout games do not update standings) |
| `POST` | `/api/v1/games/:gameId/penalty-shootout` | none | `{ message: "Penalty shootout started" }` | From `second_half` or `extra_time`; sets status `penalty_shootout` |
| `POST` | `/api/v1/games/:gameId/penalty-shootout/complete` | `{ homePenaltyScore, awayPenaltyScore }` | `{ message: "Penalty shootout completed" }` | From `penalty_shootout`; scores must differ; → `full_time` + `winnerTeamId`; advances tie when present |

### Hybrid scoring (`apiAuth` + `leagueOwner`)

Live match score +/- with unaccredited goal placeholders. See [docs/hybrid-scoring-prompt.md](docs/hybrid-scoring-prompt.md). League owner only.

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/games/:gameId/score` | `{ team: "home" \| "away", action: "increment" \| "decrement" }` | `{ message, homeScore, awayScore, statId }` | Updates game score → `GameUpdated` (`result`) → standings recalc + SSE `game_updated`; also SSE `score_updated` |
| `PATCH` | `/api/v1/games/:gameId/stats/:statId/accredit` | `{ playerId, assistPlayerId?, isOwnGoal, minute }` | `{ message: "Goal accredited", statId }` | Updates placeholder only; SSE `stat_accredited` (no standings recalc) |

### Game lineups (`apiAuth` + `lineupManager`)

League owner **or** active team admin on home/away may manage lineups. `lineupManager` middleware allows either side; the service layer restricts team admins to their own `teamId` only (league owners may edit both teams).

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| `PUT` | `/api/v1/games/:gameId/lineups` | `setLineupValidator` | `{ message: "Lineup saved successfully" }` | Replaces entire lineup for one team; exactly 11 starters with all formation slots filled |
| `PATCH` | `/api/v1/games/:gameId/lineups/:id` | `updateLineupValidator` | `{ message: "Lineup entry updated successfully" }` | Patch `jerseyNumber`, `slotKey`, `position`, `status` |
| `DELETE` | `/api/v1/games/:gameId/lineups/:id` | none | `{ message: "Player removed from lineup successfully" }` | Removes one lineup row |

`setLineup`, `updateLineup`, and `removePlayer` reject games with status `full_time` or `cancelled` (`409`). Lineups are **display-only** (starters / bench). Match substitutions are recorded as **stats** — see [Substitutions](#substitutions-via-stats) below.

**SSE on `games/{gameId}`:**

| `type` | Payload |
| --- | --- |
| `score_updated` | `{ homeScore, awayScore }` |
| `stat_accredited` | `{ statId }` |
| `game_updated` | `{ reason: "result", gameId }` — standings recalculated; clients should refetch league table |

Standings recalc runs on **game row saves** (`GameUpdated` with `reason: "result"`), not on stat create/update/delete or accredit.

---

## Response payloads (serialized routes)

### `GET /api/v1/countries/:idOrCode` → `CountryDetail`

```json
{
  "data": {
    "country": { "id": 1, "name": "Nigeria", "code": "ng" },
    "stats": {
      "leagues": 8,
      "teams": 96,
      "players": 1320,
      "liveMatches": 3
    },
    "leagues": [
      { "id": "10", "name": "Sunday Riverside League", "country": { "code": "ng", "name": "Nigeria" } }
    ],
    "teams": [{ "id": "100", "name": "Lagos Tigers", "logoUrl": null }],
    "featuredPlayers": [
      {
        "player": {
          "id": "1",
          "name": "John Doe",
          "avatarInitials": "JD",
          "position": "Midfielder",
          "teamId": "100",
          "countryCode": "ng"
        },
        "goals": 12,
        "assists": 7,
        "appearances": 18,
        "yellowCards": 2,
        "redCards": 0
      }
    ],
    "recentMatches": [
      {
        "id": "900",
        "homeTeam": { "id": "100", "name": "Lagos Tigers" },
        "awayTeam": { "id": "101", "name": "Abuja Waves" },
        "league": { "id": "10", "name": "Sunday Riverside League", "country": { "code": "ng", "name": "Nigeria" } },
        "country": { "code": "ng", "name": "Nigeria" },
        "scoreline": "2 - 1",
        "status": "FT",
        "kickoffLabel": "Fri, 23 May",
        "venue": "Riverside Pitch 2",
        "round": "Matchday 8",
        "live": false,
        "isoDate": "2026-05-23"
      }
    ]
  }
}
```

- **`stats`** — counts scoped to the country (`players` uses `players.country_id`).
- **`featuredPlayers`** — top 10 by goals in leagues in this country (stats aggregated across those leagues).
- **`recentMatches`** — last 10 games in the country’s leagues; `status` is a display label (`FT`, `LIVE`, `NS`, …); `round` is `Matchday N` from season schedule order.

### `GET /api/v1/leagues` → `{ matchDay, leagues, matches }`

```json
{
  "data": {
    "matchDay": {
      "gameDate": "2026-05-23",
      "timeZone": "Africa/Lagos"
    },
    "leagues": [
      {
        "id": 1,
        "name": "Nigeria",
        "code": "ng",
        "leagues": [{ "id": 10, "name": "Sunday Riverside League", "logoUrl": null }]
      }
    ],
    "matches": [
      {
        "id": 1,
        "name": "Nigeria",
        "code": "ng",
        "leagues": [
          {
            "id": 10,
            "name": "Sunday Riverside League",
            "logoUrl": null,
            "isFavourited": false,
            "games": [
              {
                "id": 100,
                "status": "live",
                "playedAt": "2026-05-23T17:30:00.000Z",
                "homeScore": 1,
                "awayScore": 1,
                "venueName": "Riverside Park",
                "currentMinute": 63,
                "homeTeam": { "id": 1, "name": "Riverside United", "logoUrl": null },
                "awayTeam": { "id": 2, "name": "Harborview Athletic", "logoUrl": null }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

- `matchDay` — calendar day and IANA timezone used to build the `matches` feed (resolved from query params and/or `Time-Zone` / `X-Timezone` headers).
- `leagues` — countries with league list (no game-day filter).
- `matches` — same country shape, but only countries/leagues with games on `gameDate` in `timeZone`; leagues include `isFavourited` when the request includes a valid **`Authorization: Bearer`** token (same `api` guard as favourite routes; session cookies are not used).

### `GET /api/v1/leagues/:leagueId` → `{ seasons, season, statTypes }`

- **`seasons`** — all seasons for the league (`id`, `name`, `status`), ordered active → completed → inactive, then newest first within each group. Use for the season picker.
- **`season`** — full detail for the selected season (from `seasonId` query, or default active/newest): league, **stages**, games (home/away teams), standings (with team), stats (type, player, team, relatedPlayer). Use `stages[].stageType` to choose standings vs bracket UI — see [docs/KNOCKOUT.md](docs/KNOCKOUT.md).
- **`season.stages`** — competition phases for that season (`Stage[]`: `round_robin`, `knockout`, …). Knockout-only seasons may omit round_robin.
- **`season.standings`** — one row per **team in the league** for that season when a round_robin stage exists (not only teams that have played). Teams with no finished matches appear with zeroed stats (`played`, `points`, etc.). Ordered by `position` ascending. Empty/omitted relevance for pure knockout seasons. **`points` folds in any `standing_adjustments` for the round_robin stage** (see [docs/GROUPS.md](docs/GROUPS.md#adjustments--overrides--zones)) — a deduction created via `POST .../standings/adjustments` is reflected here immediately, not just via `GET .../stages/:id/standings`.
- **`statTypes`** — global catalog of stat types (`id`, `name`, `displayName`, `iconName`, `category`), ordered by `category` then `displayName`. Use to group or label stats in the UI.

```json
{
  "data": {
    "seasons": [
      { "id": 5, "name": "2026 — Spring", "status": "active" },
      { "id": 4, "name": "2025 — Fall", "status": "completed" }
    ],
    "statTypes": [
      {
        "id": 1,
        "name": "goals",
        "displayName": "Goals",
        "iconName": "soccer-ball",
        "category": "performance"
      }
    ],
    "season": {
    "id": 5,
    "name": "2026 — Spring",
    "status": "active",
    "league": { "id": 10, "name": "Sunday Riverside League", "logoUrl": null },
    "games": [ "…Game[]" ],
    "standings": [
      {
        "id": 1,
        "position": 1,
        "played": 10,
        "wins": 7,
        "draws": 2,
        "losses": 1,
        "goalsFor": 20,
        "goalsAgainst": 8,
        "goalDifference": 12,
        "points": 23,
        "form": "W,W,D,L,W",
        "team": { "id": 1, "name": "Riverside United", "logoUrl": null }
      }
    ],
    "stats": [ "…Stat[] with nested type, team, player, relatedPlayer" ]
    }
  }
}
```

### `GET /api/v1/games/:id` → `GameDetail`

**Game (detail)** — league + stats (with type, team, player, relatedPlayer) + `lineups` grouped by team (`TeamLineupGroup[]`) + nested `venue` (`Venue (for game)` when `venueId` is set; otherwise omitted) alongside `venueName` / `venueId`.

### `GET /api/v1/formations` → `Formation[]`

Active formations only (`isActive = true`), ordered by `name`.

### `GET /api/v1/games/:gameId/lineups` → `TeamLineupGroup[]`

Each entry: `team`, `formation` (from starters), `starters`, `substitutes` — each lineup row includes nested `player`, `team`, `formation`.

### `GET /api/v1/teams/:id` → `{ team, leagues, statTypes }`

- **`team`** — `id`, `name`, `logoUrl`.
- **`leagues`** — typically one league (the team's `leagueId`), each with **`seasons`** the team participated in (games, standings row, and/or roster).
- **`statTypes`** — global stat type catalog for grouping player stats on the roster.

Each league entry's season includes:

- **`games`** — matches where this team is home or away (merged; not split into home/away arrays).
- **`standings`** — full league table for that season (all teams in the league), ordered by `position` ascending. **`points` folds in any `standing_adjustments` for the round_robin stage**, same as `GET /leagues/:leagueId` above.
- **`players`** — roster for that season via `league_players`, with stats scoped to that season.

```json
{
  "data": {
    "team": { "id": 1, "name": "Riverside United", "logoUrl": null },
    "statTypes": [
      { "id": 1, "name": "goals", "displayName": "Goals", "iconName": "soccer-ball", "category": "performance" }
    ],
    "leagues": [
      {
        "id": 10,
        "name": "Sunday Riverside League",
        "logoUrl": null,
        "seasons": [
          {
            "id": 5,
            "name": "2026 — Spring",
            "status": "active",
            "games": [ "…Game[] with homeTeam / awayTeam" ],
            "standings": [ "…Standing[] with team" ],
            "players": [ "…Player[] with stats for this season" ]
          }
        ]
      }
    ]
  }
}
```

### `GET /api/v1/players/does-user-have-player-profile`

Checks whether the **authenticated user** (`apiAuth` Bearer token) has a linked player profile (`players.user_id`).

```json
{ "hasPlayerProfile": true }
```

Use before invite accept / profile creation to decide whether to show the player onboarding form.

### `GET /api/v1/players/:id` → `{ player, leagues, statTypes }`

- **`player`** — **Player (profile)**: `id`, `name`, `avatarUrl`, `bio`, `primaryPosition`, `secondaryPosition`, `preferredFoot`, `heightCm`, `city`, `state`, `nationality`, `socialHandle`, `age`, `country`, `highlights`.
- **`leagues`** — leagues the player belongs to (from `league_players` and/or stats), each with **`seasons`** for filtering in the UI.
- **`statTypes`** — global stat type catalog for grouping (same shape as league detail).
- If the player's `visibility` is `private`, `player` collapses to `{ id, name, visibility: "private" }` and `leagues` / `statTypes` are both returned empty — see [docs/PLAYER_PROFILE.md](docs/PLAYER_PROFILE.md).

Each league entry:

```json
{
  "id": 10,
  "name": "Sunday Riverside League",
  "logoUrl": null,
  "seasons": [
    {
      "id": 5,
      "name": "2026 — Spring",
      "status": "active",
      "team": { "id": 1, "name": "Riverside United", "logoUrl": null },
      "games": [ "…Game[] with homeTeam / awayTeam" ],
      "stats": [ "…Stat[] with type, team, relatedPlayer (no nested player)" ]
    }
  ]
}
```

- **`seasons`** — ordered active → completed → inactive, then newest first.
- **`games`** — matches for that season where the player's team played, plus any game linked from their stats.
- **`stats`** — all stat events for that player in that league + season.

```json
{
  "data": {
    "player": {
      "id": 1,
      "name": "Ada Player",
      "avatarUrl": null,
      "bio": "Box-to-box midfielder",
      "primaryPosition": "midfield",
      "secondaryPosition": null,
      "preferredFoot": "right",
      "heightCm": 175,
      "city": "Lagos",
      "state": null,
      "nationality": "Nigerian",
      "socialHandle": "@ada.plays",
      "visibility": "active",
      "age": 24,
      "country": { "id": 1, "name": "Nigeria", "code": "ng" },
      "highlights": [
        { "id": 1, "videoId": "dQw4w9WgXcQ", "title": "Hat-trick vs Riverside", "sortOrder": 0, "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }
      ]
    },
    "statTypes": [
      { "id": 1, "name": "goals", "displayName": "Goals", "iconName": "soccer-ball", "category": "performance" }
    ],
    "leagues": [ "…league with seasons[] as above" ]
  }
}
```

### `GET /api/v1/me/player` → `{ player, completeness, missingFields, highlightsCount, membership }`

The two-state CTA resolver — see [docs/PLAYER_PROFILE.md](docs/PLAYER_PROFILE.md).
`player` is the same **Player (profile)** shape as `GET /players/:id` above.
`completeness` (0–100) and `missingFields` (checklist keys: `photo`, `bio`,
`primaryPosition`, `preferredFoot`, `dateOfBirth`, `city`, `highlights`) are
computed server-side so the rule lives in one place. `membership.inLeague` /
`membership.inTeam` reflect any **active** `league_players` row.

```json
{
  "data": {
    "player": { "id": 1, "name": "Ada Player", "…rest of Player (profile)": "…" },
    "completeness": 60,
    "missingFields": ["photo", "highlights"],
    "highlightsCount": 0,
    "membership": { "inLeague": true, "inTeam": true }
  }
}
```

`GET /me/player` returns **404** (not a 200 with `null`) when the
authenticated user has no `players` row — that 404 is the "no profile" signal
the app's profile tab uses to show the create-profile CTA instead of parsing
response contents.

### `GET /api/v1/search`

```json
{
  "data": {
    "query": "river",
    "results": [
      {
        "id": "10",
        "type": "league",
        "label": "Sunday Riverside League",
        "sublabel": "Nigeria",
        "countryCode": "ng",
        "logoUrl": "http://localhost:3333/uploads/leagues/abc.jpg"
      },
      {
        "id": "1",
        "type": "team",
        "label": "Riverside United",
        "sublabel": "Sunday Riverside League",
        "countryCode": "ng",
        "logoUrl": null
      }
    ]
  }
}
```

### `GET /api/v1/leagues/league-player-requests`

Array of **LeaguePlayer (with league)** — response is **not** wrapped in `{ data: … }`.

```json
[
  {
    "id": 1,
    "status": "pending",
    "league": { "id": 10, "name": "Sunday Riverside League", "logoUrl": null },
    "team": { "id": 1, "name": "Riverside United", "logoUrl": null }
  }
]
```

---

## Validators (request bodies)

`resourceId("table")` means: required positive integer that exists in that table’s `id` column.

### `requestOtpValidator` — `POST /api/v1/auth/request-otp`

| Field | Rules |
| --- | --- |
| `email` | required string, valid email format |
| `name` | optional string; required in practice for new users (server returns `428` if missing) |
| `recoveryEmail` | optional string, valid email format; must not already exist in `users.recovery_email` |

Server logic: existing user → send OTP (`200`); new user without `name` → `428` with `requiresSignup: true`; new user with `name` → create account, send OTP (`200`).

### `verifyOtpValidator` — `POST /api/v1/auth/verify-otp`

| Field | Rules |
| --- | --- |
| `email` | required string, valid email format |
| `code` | required string, exactly 6 characters |

User must already exist (created on signup `request-otp` or from a prior login).

### `requestRecoveryValidator` — `POST /api/v1/auth/recover`

| Field | Rules |
| --- | --- |
| `recoveryEmail` | required string, valid email format; must **exist** in `users.recovery_email` |

### `createLeagueWithSeasonValidator` — `POST /api/v1/leagues`

| Field | Rules |
| --- | --- |
| `name` | string, 1–255 chars, trimmed |
| `description` | optional string, max 2000, nullable |
| `gender` | optional string, max 32, nullable |
| `logo` | optional image file: max 2mb; extensions jpg, jpeg, png, webp |
| `countryId` | required; must exist in `countries` |
| `seasonName` | string, 1–120 chars, trimmed |
| `tiebreaker` | optional enum: `goal_difference_goals_scored` (default), `goals_scored_goal_difference`, `wins_goal_difference_goals_scored`, `goal_difference_goals_conceded`, `goal_difference_goals_scored_away_goals`, `goal_difference_goals_scored_head_to_head`, `head_to_head_goal_difference_goals_scored`, `head_to_head_goals_scored_goal_difference`, `away_goals_scored_goal_difference_goals_scored` |
| `startDate` | optional date (`YYYY-MM-DD` or ISO 8601), nullable — league duration start |
| `endDate` | optional date (`YYYY-MM-DD` or ISO 8601), nullable — league duration end |
| `format` | optional `league` \| `knockout` \| `group` (default `league`) — which stage to create for the first season |
| `knockout` | required when `format` is `knockout`: `{ name?, seed?, config }` — `config` matches knockout stage config; `seed` defaults `true` (auto-seed when ≥ 2 teams, array order = seeds). See [docs/KNOCKOUT.md](docs/KNOCKOUT.md) |
| `group` | optional when `format` is `group`: `{ name?, config? }` — defaults `group_count: 2`, `double_round_robin: false`, `per_group: 2`. No auto assign/fixtures. See [docs/GROUPS.md](docs/GROUPS.md) |
| `teams` | optional array of `{ name: string (1–255), logo?: image file }` — each team `logo` is uploaded to Drive and stored as `logoUrl` on the team row (same as `POST /leagues/:leagueId/teams`) |

Success body: `{ message, leagueId, seasonId, stageId, format, seeded }`.

### `updateLeagueValidator` — `PUT /api/v1/leagues/:leagueId`

All fields optional: `name`, `description`, `gender`, `logo` (image file; stored as `logoUrl` via Drive upload), `tiebreaker` (enum; re-sorts the **active** season standings immediately when changed), `startDate`, `endDate` (dates, nullable).

### `createSeasonValidator` — `POST /api/v1/leagues/:leagueId/seasons`

| Field | Rules |
| --- | --- |
| `leagueId` | required; exists in `leagues` (also taken from URL for ownership) |
| `name` | string, 1–255 chars |
| `status` | `inactive` \| `active` \| `completed` |
| `format` | optional `league` \| `knockout` \| `group` (default `league`) |
| `knockout` | required when `format` is `knockout`: `{ name?, config }` (no auto-seed) |
| `group` | optional when `format` is `group`: `{ name?, config? }` (no auto assign/fixtures) |

Setting `status` to `active` marks all other `active` seasons in the same league as `completed`.

### `updateSeasonValidator` — `PUT /api/v1/leagues/:leagueId/seasons/:seasonId`

| Field | Rules |
| --- | --- |
| `name` | optional string, 1–255 chars |
| `status` | optional `inactive` \| `active` \| `completed` |

Setting `status` to `active` marks all other `active` seasons in the same league as `completed` (excluding the season being updated).

### `createTeamValidator` — `POST /api/v1/leagues/:leagueId/teams`

| Field | Rules |
| --- | --- |
| `leagueId` | required; exists in `leagues` |
| `name` | required string, 1–255 |
| `logo` | optional image (2mb, jpg/jpeg/png/webp) |

`addedBy` is set server-side from the authenticated user.

### `updateTeamValidator` — `PUT /api/v1/leagues/:leagueId/teams/:id`

Optional: `name`, `logo` (image file; stored as `logoUrl` via Drive upload).

### `createLeaguePlayerValidator` — `POST /api/v1/leagues/assign-team`

| Field | Rules |
| --- | --- |
| `leagueId`, `playerId`, `seasonId`, `teamId` | required FKs |
| `jerseyNumber` | optional string, max 5 |
| `status` | optional: `active` \| `transferred` \| `injured` \| `suspended` (default `active` in controller) |
| `isCaptain` | optional boolean |
| `position` | optional nullable: `attack` \| `defence` \| `midfield` \| `goalkeeper` |
| `joinedAt`, `leftAt` | optional dates (ISO8601 or `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`) |

### `acceptLeaguePlayerRequestValidator` — `POST /api/v1/leagues/accept-league-player-request`

Required: `playerId`, `leagueId`, `seasonId` (all must exist in DB).

### `updateLeaguePlayerValidator` — `PUT /api/v1/leagues/league-players/:id`

Optional: `jerseyNumber`, `status`, `isCaptain`, `position`, `joinedAt`, `leftAt`.

### `createPlayerProfileValidator` — `POST /api/v1/me/player`

| Field | Rules |
| --- | --- |
| `name` | required, 1–255 chars |
| `countryId` | required FK → `countries` |
| `bio` | optional nullable, max 300 chars |
| `primaryPosition`, `secondaryPosition` | optional nullable enum: `goalkeeper` \| `defence` \| `midfield` \| `attack` |
| `preferredFoot` | optional nullable enum: `left` \| `right` \| `both` |
| `heightCm` | optional nullable integer, 100–250 |
| `dateOfBirth` | optional nullable date; server also enforces not-in-future and an implied age of 5–70 |
| `city`, `state`, `nationality`, `socialHandle` | optional nullable, max 120 chars each |

`updatePlayerProfileValidator` (`PUT /api/v1/me/player`) is the same shape
with every field optional (including `name` / `countryId`).

### `playerPhotoValidator` — `POST /api/v1/me/player/photo`

`photo`: required file, max 2 MB, `jpg` \| `jpeg` \| `png` \| `webp`.

### `createHighlightValidator` — `POST /api/v1/me/player/highlights`

| Field | Rules |
| --- | --- |
| `url` | required string, max 500 chars; must parse to a valid YouTube video ID — see [docs/PLAYER_PROFILE.md](docs/PLAYER_PROFILE.md) |
| `title` | optional nullable, max 140 chars |

`updateHighlightValidator` (`PUT /api/v1/me/player/highlights/:hid`): `title`
(nullable, max 140 chars). `reorderHighlightsValidator` (`PUT
/api/v1/me/player/highlights/reorder`): `ids` — array of positive integers,
must be exactly the caller's own highlight IDs, each exactly once.

### `generateInviteValidator` — `GET /api/v1/invites/generate`

| Field | Rules |
| --- | --- |
| `leagueId`, `seasonId`, `teamId` | required FKs (query string) |
| `invitedUserId` | optional FK to `users` (Flow A); omit for general invite (Flow B) |

### `createGameValidator` — `POST /api/v1/leagues/games`

| Field | Rules |
| --- | --- |
| `leagueId`, `seasonId`, `homeTeamId`, `awayTeamId` | required FKs |
| `playedAt` | required date |
| `homeScore`, `awayScore` | optional integer 0–99, nullable |
| `currentMinute` | optional integer 0–130 |
| `status` | optional game status enum |
| `venueName` | optional string, max 255, nullable |
| `venueId` | optional FK to `venues`, nullable — must belong to `leagueId`; when set, server copies venue name into `venueName` |

Server sets `stage_id` to the season’s `round_robin` stage (creates one if missing). Do not send knockout `tieId` / `leg` here.

### `createKnockoutStageValidator` — `POST /api/v1/leagues/:leagueId/stages`

| Field | Rules |
| --- | --- |
| `seasonId` | required FK → `seasons` (must belong to `leagueId`) |
| `name` | required string, 1–255 |
| `sequence` | optional integer ≥ 1 (defaults to max existing + 1) |
| `config.format.starting_round` | optional bracket round enum |
| `config.format.has_third_place` | optional boolean |
| `config.ties.default.tie_format` | required `single` \| `two_legged` \| `best_of` |
| `config.ties.default.best_of` | required when `best_of` (1–15) |
| `config.ties.default.away_goals` | optional boolean (two_legged) |
| `config.ties.rounds` | optional per-round overrides (same fields) |

### `seedKnockoutStageValidator` — `POST /api/v1/leagues/stages/:id/seed`

| Field | Rules |
| --- | --- |
| `seededTeams` | array of team FKs, min length 2, unique, all in the stage’s league |

### `nextRoundValidator` — `POST /api/v1/leagues/stages/:id/next-round`

| Field | Rules |
| --- | --- |
| `completedRound` | required bracket round (`r256`…`final`, `third_place` rejected by service) |

### `completePenaltyShootoutValidator` — `POST /api/v1/games/:gameId/penalty-shootout/complete`

| Field | Rules |
| --- | --- |
| `homePenaltyScore`, `awayPenaltyScore` | required integers 0–50; must differ |

### `updateGameValidator` — `PUT /api/v1/leagues/games/:id`

Optional: `homeScore`, `awayScore`, `currentMinute`, `status`, `playedAt`, `venueName`, `venueId` (nullable to clear FK).

### `createVenueValidator` — `POST /api/v1/leagues/:leagueId/venues`

| Field | Rules |
| --- | --- |
| `name` | required string, 1–255 |
| `address` | optional string, max 500, nullable |
| `latitude` | optional number, −90…90, nullable |
| `longitude` | optional number, −180…180, nullable |
| `googlePlaceId` | optional string, max 255, nullable |
| `capacity` | optional integer 0–999999, nullable |
| `city` | optional string, max 120, nullable |
| `notes` | optional string, nullable |

### `updateVenueValidator` — `PUT /api/v1/leagues/venues/:id`

Same fields as create; all optional.

### `createStatValidator` — `POST /api/v1/leagues/stats`

Server also checks: `game` belongs to `leagueId`/`seasonId`; `teamId` is home or away in that game; `playerId` has active `league_players` row for that team/season. Scores are **not** updated — use `PUT /leagues/games/:id` separately.

| Field | Rules |
| --- | --- |
| `gameId`, `playerId`, `leagueId`, `seasonId`, `teamId`, `statTypeId` | required FKs (`statTypeId` → `stat_types` table) |
| `relatedPlayerId` | optional FK to `players`, nullable |
| `minute` | optional integer 0–130, nullable |
| `isStoppageTime` | optional boolean |
| `value` | optional string, max 500, nullable |
| `numericValue` | optional integer 0–999 |

### `updateStatValidator` — `PUT /api/v1/leagues/stats/:id`

Optional: `relatedPlayerId`, `minute`, `isStoppageTime`, `value`, `numericValue`. Does **not** allow changing `playerId` or `statTypeId` — delete and recreate (or use `POST .../substitutions` again) to change who was involved in a substitution.

### `recordSubstitutionValidator` — `POST /api/v1/leagues/stats/substitutions`

| Field | Rules |
| --- | --- |
| `gameId`, `leagueId`, `seasonId`, `teamId` | required FKs |
| `substitutions` | array, 1–11 items |
| `substitutions[].playerOffId` | required FK → `players`; must be `status: starter` in this team's lineup |
| `substitutions[].playerOnId` | required FK → `players` (≠ off); must be `status: substitute` in this team's lineup |
| `substitutions[].minute` | integer 0–130 |
| `substitutions[].isStoppageTime` | optional boolean |

Server also rejects duplicate players across the batch and players missing from the lineup.

### `recordTrackingEventsValidator` — `POST /api/v1/games/:gameId/tracking-events`

Passes and shots are stored as atomic `stats` rows. Attempted counts are derived from row count, not stored separately.

| Field | Rules |
| --- | --- |
| `events` | array, 1–250 items |
| `events[].clientEventId` | required UUID; unique retry key used for dedupe |
| `events[].type` | `pass` or `shot` |
| `events[].teamId` | required FK → `teams`; must be home or away team for the game |
| `events[].playerId` | required FK → `players`; must be in submitted starter/substitute lineup for that team, or on the active roster when that team has no submitted lineup |
| `events[].minute` | optional integer 0–130, nullable |
| `events[].isStoppageTime` | optional boolean |
| `events[].completed` | required boolean for `pass`; stored in `qualifiers.completed` |
| `events[].onTarget` | required boolean for `shot`; stored in `qualifiers.on_target` |

Derived metrics on game detail:

| Metric | Rule |
| --- | --- |
| Possession | team pass rows / total pass rows across both teams. When no passes exist, possession is `0` and `possessionTracked` is `false`. |
| Pass completion | completed pass rows / all pass rows. |
| Shot accuracy | on-target shot rows / all shot rows. |

## Push Notifications

Push alerts are explicit league opt-in. A user only receives alerts for leagues where
they turned notifications on. Favourites do not automatically enable push alerts.

### `POST /api/v1/push/tokens`

Auth required. Registers or refreshes the user's Expo push token.

| Field | Rules |
| --- | --- |
| `provider` | optional enum: `expo` |
| `token` | required string, max 255 |
| `platform` | optional enum: `ios`, `android`, `web`, `unknown` |
| `deviceId` | optional string, max 128, nullable |

### `GET /api/v1/leagues/:leagueId/notifications`

Auth required. Returns the current user's notification preference for a league.
Missing rows return `enabled: false` with kickoff/final-score capabilities enabled.

```json
{
  "data": {
    "preference": {
      "leagueId": 1,
      "enabled": true,
      "kickoffEnabled": true,
      "finalScoreEnabled": true
    }
  }
}
```

### `PUT /api/v1/leagues/:leagueId/notifications`

Auth required. Enables or disables push alerts for a league.

| Field | Rules |
| --- | --- |
| `enabled` | required boolean |

### Notification events

The backend currently sends only low-frequency match alerts:

| Event | Trigger |
| --- | --- |
| `kickoff` | Match Center starts first half. |
| `final_score` | Match Center ends the game or completes a penalty shootout. |

Expo push sends are background best-effort. If Expo is unavailable, the match action
still succeeds. Expo `DeviceNotRegistered` responses disable that stored token.

### `setLineupValidator` — `PUT /api/v1/games/:gameId/lineups`

| Field | Rules |
| --- | --- |
| `teamId` | required FK → `teams` |
| `formationId` | required FK → `formations` |
| `starters` | array, exactly 11 items: `{ playerId, slotKey, jerseyNumber? }` |
| `substitutes` | array, max 12 items: `{ playerId, jerseyNumber? }` |

### `updateLineupValidator` — `PATCH /api/v1/games/:gameId/lineups/:id`

Optional: `jerseyNumber` (1–99, nullable), `slotKey` (string, nullable), `position` (`LINEUP_POSITIONS`, nullable), `status` (`starter` \| `substitute` \| `did_not_play`).

### `assignTeamAdminValidator` — `POST /api/v1/leagues/:leagueId/teams/:teamId/admins`

| Field | Rules |
| --- | --- |
| `userId` | required FK → `users` |

### `bugReportValidator` — `POST /api/v1/support/bug-reports`

| Field | Rules |
| --- | --- |
| `type` | optional enum: `bug`, `confusing_flow`, `feature_request`, `account_access`, `other` |
| `title` | required string, 3–140 |
| `description` | required string, 10–4000 |
| `expected` | optional string, max 2000 |
| `email` | optional valid email |
| `route`, `appVersion`, `platform`, `osVersion`, `deviceModel` | optional strings |

### Google Sheets support content

The support endpoints use a Google Sheet with tabs named `faq` and `bugs` by default. Set `SUPPORT_SHEETS_SPREADSHEET_ID` or the existing alias `GOOGLE_SHEETS_SPREADSHEET_ID`. Sheet tab aliases `GOOGLE_SHEETS_FAQ_NAME` and `GOOGLE_SHEETS_BUGS_NAME` are also supported.

Supported credentials:

| Env | Meaning |
| --- | --- |
| `SUPPORT_GOOGLE_CLIENT_EMAIL` + `SUPPORT_GOOGLE_PRIVATE_KEY` | Inline service account credentials. Existing aliases `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` are supported. |
| `SUPPORT_GOOGLE_SERVICE_ACCOUNT_KEY` | Raw service account JSON. Existing alias `GOOGLE_SERVICE_ACCOUNT` is supported. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON. |
| `GCS_KEY` | Existing file path fallback, if it points to service account JSON with Sheets access. |
| `SUPPORT_SEED_TOKEN` | Production-only guard for `POST /api/v1/support/faqs/seed` through `x-support-seed-token`. |

The bundled FAQ rows can also be appended from the API repo with:

```bash
node --env-file=.env.prod ace.js support:seed-faqs
```

---

## Middleware

| Middleware | Meaning |
| --- | --- |
| `apiAuth` | Bearer access token (`api` guard). |
| `leagueOwner` | Authenticated user must own the league. Resolves `leagueId` from, in order: `params.leagueId` (URL), `leagueId` in body/query, `params.gameId` (load game → `leagueId`), or the parent game/stat/venue/stage/league-player/adjustment/override/zone row for `params.id` / `aid` / `oid` / `zid` on `/games/`, `/venues/`, `/stages/`, `/stats/`, `/league-players/`, `/adjustments/`, `/overrides/`, `/zones/` paths (`/stages/` → stage → season → league). Used for league manage routes and Match Center clock/score. |
| `lineupManager` | Authenticated user must be league owner for the game's league **or** an active team admin (`team_admins`, `removed_at` null) on home or away. Used for lineup mutations only. Team admins are further scoped to their own team in `LineupService`. |

## Notes

- **Favourites:** Routes use US spelling (`/favorite`); the pivot table is `favourite_leagues`. `POST` attaches the league to the authenticated user; `DELETE` detaches. No `leagueOwner` check — any logged-in user can favourite any league. `GET /api/v1/leagues` sets `isFavourited` on leagues in `matches` and `leagues` when a Bearer token is sent.
- **League push alerts:** `GET /api/v1/leagues` sets `notificationsEnabled` on leagues in `matches` and `leagues` when a Bearer token is sent. This powers the Home bell icon without a per-row preference request.
- Logo uploads use Drive (`moveToDisk`); league/team logos are stored and exposed as URLs in `logoUrl`. New league-scoped uploads use `leagues/{leagueId}-{leagueSlug}/logo/{uuid}.{ext}` for league logos and `leagues/{leagueId}-{leagueSlug}/teams/{teamId}-{teamSlug}/logo/{uuid}.{ext}` for team logos. Player avatars remain separate under `players/{playerId}-{playerSlug}/avatar/{uuid}.{ext}`.
