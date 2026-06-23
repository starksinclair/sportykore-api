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
| **League** | `id`, `name`, `logoUrl` (string \| null), optional `games` → **Game[]** |
| **Team** | `id`, `name`, `logoUrl` (string \| null) |
| **Team (with games)** | **Team** + `homeGames`, `awayGames` → **Game[]** |
| **Player** | `id`, `name`, `avatarUrl` (string \| null) |
| **Player (with stats)** | **Player** + `stats` → **Stat[]** |
| **StatType** | `id`, `name`, `displayName`, `iconName` (string \| null), `category` (string \| null) |
| **Stat** | `id`, `minute` (number \| null), `isStoppageTime` (boolean \| null), `numericValue` (number \| null), `isUnaccredited` (boolean), `type` → **StatType** \| omitted, `team` → **Team** \| omitted, `player` → **Player** \| omitted, `relatedPlayer` → **Player** \| omitted |
| **Standing** | `id`, `position`, `played`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`, `goalDifference`, `points`, `form` (string \| null), `team` → **Team** \| omitted |
| **Game** | `id`, `status`, `playedAt`, `homeScore`, `awayScore`, `venueName`, `currentMinute`, `homeTeam` → **Team** \| omitted, `awayTeam` → **Team** \| omitted |
| **Game (detail)** | **Game** + `league` → **League** \| omitted, `stats` → **Stat[]** |
| **Season** | `id`, `name`, `status`, optional nested: `league`, `games`, `standings`, `stats` |
| **SearchHit** | `id` (string), `type` (`country` \| `league` \| `team` \| `player`), `label`, optional `sublabel`, optional `countryCode`, optional `logoUrl` (string \| null; set for `league` and `team` hits from `leagues.logo_url` / `teams.logo_url`, `null` for `country` and `player`) |
| **LeaguePlayer** | `id`, `status`, `position`, `jerseyNumber`, `isCaptain` |
| **LeaguePlayer (with league)** | **LeaguePlayer** + `league` → **League**, `team` → **Team** |
| **LeaguePlayer (with player)** | **LeaguePlayer** + `player` → **Player**, `team` → **Team** |
| **OwnedLeague** | `id`, `name`, `logoUrl`, `countryId`, `activeSeason` → **Season** \| null |
| **User** | `id`, `email`, `fullName` |
| **AuthSession** | `auth.user` → **User**; `auth.token` → `{ type: 'bearer', value, expiresAt, abilities }` |

### Game `status` values

`scheduled` \| `first_half` \| `half_time` \| `second_half` \| `extra_time` \| `full_time` \| `cancelled` \| `postponed` \| `paused`

- **`currentMinute`** in API responses is **computed** from period start timestamps (`firstHalfStartedAt`, etc.) — not polled/stored every minute. See [docs/CHANGE_GAME.md](docs/CHANGE_GAME.md).
- Query param **`gameStatus=live`** on `GET /api/v1/leagues` matches any in-play status (`first_half`, `second_half`, `extra_time`, `paused`).

### Season `status` values

`inactive` \| `active` \| `completed`

### Roster `status` values (league_players)

`active` \| `transferred` \| `injured` \| `suspended`

### Roster `position` values (league_players, nullable)

`attack` \| `defence` \| `midfield` \| `goalkeeper`

### Stat type `name` values (seeded)

Includes `goals`, `own_goal`, `assists`, `yellow_card`, `red_card`, `saves`, `shots_on_target`, `fouls_conceded`, `substitution_on`, `substitution_off`.

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

| Method | Path | Input | Success response | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/auth/users/me` | none | **`{ data: User }`** — `id`, `email`, `fullName` | Logged-in check |
| `GET` | `/api/v1/auth/users/leagues` | none | **`{ data: OwnedLeague[] }`** — `id`, `name`, `logoUrl`, `countryId`, `activeSeason?` | Leagues where `user_id` = auth user |
| `GET` | `/api/v1/auth/users/leagues/:leagueId/teams` | **Params:** `leagueId` | **`{ data: Team[] }`** | `403` if not league owner |
| `GET` | `/api/v1/auth/users/search` | **Query:** `q`, `leagueId` (required), `limit?` (1–50, default 20) | **`{ data: User[] }`** | Flow A user picker; `403` if not owner |

---

## Routes

| Method | Path | Auth | Input | Success response | Errors / notes |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/v1/countries` | none | none | **`{ data: CountryRef[] }`** — `id`, `name`, `code` only | Always `200` |
| `GET` | `/api/v1/countries/:idOrCode` | none | **Params:** numeric `id` (e.g. `1`) or ISO country `code` (e.g. `ng`) | **`{ data: CountryDetail }`** — see below | `404` country not found |
| `GET` | `/api/v1/leagues` | none | **Query:** `countryId?`, `gameStatus?`, `gameDate?` (`YYYY-MM-DD`, default today), `timeZone?` (IANA, e.g. `Africa/Lagos`; default `UTC`). `matches` filters `played_at` to that **local calendar day** converted to UTC. See [docs/TIME_AND_TIMEZONE.md](docs/TIME_AND_TIMEZONE.md). | **`{ data: { leagues, matches } }`** — `leagues` unfiltered list; `matches` game feed | `400` invalid `gameDate` / `timeZone`; empty `matches` if no games that day |
| `GET` | `/api/v1/leagues/:leagueId` | none | **Params:** `leagueId`. **Query:** `seasonId?` (positive integer; defaults to the league's `active` season, else the newest) | **`{ data: { seasons, season, statTypes } }`** — see below | `400` invalid `leagueId` or `seasonId`; `404` league/season not found |
| `POST` | `/api/v1/leagues` | `apiAuth` | **Body:** `createLeagueWithSeasonValidator` — see below | **`201`** `{ inviteUrl: string }` (not wrapped in `data`) | Validation `422`; creates league + active season + optional teams |
| `POST` | `/api/v1/leagues/:leagueId/favorite` | `apiAuth` | **Params:** `leagueId` (positive integer; must exist in `leagues`). No body. | `{ message: "League added to favorites" }` | `401` unauthorized; `409` already favourited; `422` invalid or missing league |
| `DELETE` | `/api/v1/leagues/:leagueId/favorite` | `apiAuth` | **Params:** `leagueId` (positive integer; must exist in `leagues`). No body. | `{ message: "League removed from favorites" }` | `401` unauthorized; `422` invalid or missing league; idempotent if not favourited |
| `PUT` | `/api/v1/leagues/:leagueId` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `updateLeagueValidator` | `{ message: "League updated successfully" }` | `400` invalid id; `403` not owner; `404` league |
| `GET` | `/api/v1/search` | none | **Query:** `q` (string, trimmed; empty → no search), `limit?` (number 1–100, default 24) | **`{ data: { query: string, results: SearchHit[] } }`** | Always `200`; empty `q` → `results: []` |
| `GET` | `/api/v1/games/:id` | none | **Params:** `id` (game id) | **`{ data: GameDetail }`** | `404` if game missing |
| `GET` | `/api/v1/teams/:id` | none | **Params:** `id` (team id) | **`{ data: { team, leagues, statTypes } }`** — see below | `404` if team missing |
| `GET` | `/api/v1/players/:id` | none | **Params:** `id` (player id) | **`{ data: { player, leagues, statTypes } }`** — see below | `404` if player missing |
| `GET` | `/api/v1/players/does-user-have-player-profile` | `apiAuth` | none | `{ hasPlayerProfile: boolean }` (not wrapped in `data`) | `401` without Bearer token; checks whether the authenticated user has a `players` row |
| `GET` | `/api/v1/invites/generate` | `apiAuth` + `leagueOwner` | **Query:** `leagueId`, `seasonId`, `teamId`, `invitedUserId?` | `{ inviteLink: string }` (not wrapped in `data`) | See [docs/PLAYER_INVITE.md](docs/PLAYER_INVITE.md) |
| `GET` | `/api/v1/invites/accept/:token` | `apiAuth` | **Params:** `token` | If no player profile: `{ requiresProfile: true, token: string }`. Else: `{ requiresProfile: false, leagueId: number \| null }` | `401` without Bearer token; `403` wrong user; `409` already on roster; `404` invalid/expired invite |
| `POST` | `/api/v1/invites/complete-profile-and-accept/:token` | `apiAuth` | **Params:** `token`. **Body:** `multipart/form-data` or JSON — `name` (string, required), `countryId` (required FK to `countries`), `bio?` (string, optional), `avatar?` (image file, max 2 MB, jpg/jpeg/png/webp) | `{ leagueId: number \| null }` | `409` if player profile already exists; `422` validation |
| `GET` | `/api/v1/leagues/league-player-requests` | `apiAuth` | none | **LeaguePlayerWithLeague[]** (not wrapped in `data`) | Lists `league_players` where `player_id = auth user id` and `status = pending` |
| `POST` | `/api/v1/leagues/accept-league-player-request` | `apiAuth` | **Body:** `acceptLeaguePlayerRequestValidator` | `{ message: "League player request accepted successfully" }` | `404` row missing; `409` already active |
| `POST` | `/api/v1/leagues/:leagueId/seasons` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `createSeasonValidator` | **`201`** raw season row: `{ id, leagueId, name, status, createdAt, updatedAt }` | Validation `422` |
| `POST` | `/api/v1/leagues/:leagueId/teams` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`. **Body:** `createTeamValidator` | **`201`** `{ message: "Team created successfully" }` | Logo uploaded to drive when provided |
| `PUT` | `/api/v1/leagues/:leagueId/teams/:id` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `id` (team id). **Body:** `updateTeamValidator` | `{ message: "Team updated successfully" }` | `404` team |
| `DELETE` | `/api/v1/leagues/:leagueId/teams/:id` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `id` (team id) | `{ message: "Team deleted successfully" }` | `404` if team missing or not in league; cascades related games, standings, roster rows, stats, invites |
| `POST` | `/api/v1/leagues/assign-team` | `apiAuth` + `leagueOwner` | **Body:** `createLeaguePlayerValidator` | `{ message: "Player assigned to team successfully" }` or `"...Invited to join team successfully"` if `status` ≠ `active` | Upserts `league_players` by player + league + season |
| `GET` | `/api/v1/leagues/:leagueId/seasons/:seasonId/roster` | `apiAuth` + `leagueOwner` | **Params:** `leagueId`, `seasonId` | **`{ data: LeaguePlayerWithPlayer[] }`** | Season roster for manage Players tab |
| `PUT` | `/api/v1/leagues/league-players/:id` | `apiAuth` + `leagueOwner` | **Params:** `id`. **Body:** `updateLeaguePlayerValidator` | `{ message: "League player updated successfully" }` | |
| `DELETE` | `/api/v1/leagues/league-players/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` | `{ message: "League player removed successfully" }` | |
| `POST` | `/api/v1/leagues/games` | `apiAuth` + `leagueOwner` | **Body:** `createGameValidator` | **`201`** `{ message: "Game created successfully" }` | |
| `PUT` | `/api/v1/leagues/games/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (game id). **Body:** `updateGameValidator` | `{ message: "Game updated successfully" }` | `404` game; client updates scores here (not via stats) |
| `DELETE` | `/api/v1/leagues/games/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (game id) | `{ message: "Game deleted successfully" }` | Cascades stats |
| `POST` | `/api/v1/leagues/stats` | `apiAuth` + `leagueOwner` | **Body:** `createStatValidator` | **`201`** `{ message: "Stat created successfully" }` | Validates player on active roster + correct team side; does **not** auto-update game score |
| `PUT` | `/api/v1/leagues/stats/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (stat id). **Body:** `updateStatValidator` | `{ message: "Stat updated successfully" }` | `404` stat |
| `DELETE` | `/api/v1/leagues/stats/:id` | `apiAuth` + `leagueOwner` | **Params:** `id` (stat id) | `{ message: "Stat deleted successfully" }` | Recalculates standings / broadcasts game update |

### Live game time (`apiAuth` + `teamOwner`)

League owner **or** home/away team owner (`teams.added_by`) may control match clock. Each action broadcasts SSE `status_changed` on channel `games/{gameId}`. See [docs/CHANGE_GAME.md](docs/CHANGE_GAME.md).

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/games/:gameId/start-first-half` | none | `{ message: "First half started" }` | From `scheduled` or `postponed`; sets `firstHalfStartedAt` |
| `POST` | `/api/v1/games/:gameId/half-time` | none | `{ message: "Half time" }` | From `first_half` |
| `POST` | `/api/v1/games/:gameId/start-second-half` | none | `{ message: "Second half started" }` | From `half_time`; sets `secondHalfStartedAt` |
| `POST` | `/api/v1/games/:gameId/extra-time` | none | `{ message: "Extra time started" }` | From `second_half`; sets `extraTimeStartedAt` |
| `POST` | `/api/v1/games/:gameId/pause` | none | `{ message: "Game paused" }` | From `first_half`, `second_half`, or `extra_time`; stores `pausedAt` + `pausedFromStatus` |
| `POST` | `/api/v1/games/:gameId/resume` | none | `{ message: "Game resumed" }` | From `paused`; shifts period start timestamp by pause duration |
| `POST` | `/api/v1/games/:gameId/full-time` | `{ homeScore, awayScore }` (required) | `{ message: "Full time" }` | From `second_half` or `extra_time`; fires `GameUpdated` → standings |

### Hybrid scoring (`apiAuth` + `teamOwner`)

Live match score +/- with unaccredited goal placeholders. See [docs/hybrid-scoring-prompt.md](docs/hybrid-scoring-prompt.md).

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/games/:gameId/score` | `{ team: "home" \| "away", action: "increment" \| "decrement" }` | `{ message, homeScore, awayScore, statId }` | `increment` creates unaccredited goal stat (`playerId: null`); `statId` returned for accredit flow; SSE `score_updated`; `GameUpdated` reason `result` |
| `PATCH` | `/api/v1/games/:gameId/stats/:statId/accredit` | `{ playerId, assistPlayerId?, isOwnGoal, minute }` | `{ message: "Goal accredited", statId }` | Updates placeholder; optional assist stat; SSE `stat_accredited`; `GameUpdated` reason `stat` |

**SSE on `games/{gameId}`:**

| `type` | Payload |
| --- | --- |
| `score_updated` | `{ homeScore, awayScore }` |
| `stat_accredited` | `{ statId }` |

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

### `GET /api/v1/leagues` → `{ leagues, matches }`

```json
{
  "data": {
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

- `leagues` — countries with league list (no game-day filter).
- `matches` — same country shape, but only countries/leagues with games on `gameDate` in `timeZone`; leagues include `isFavourited` when the request includes a valid **`Authorization: Bearer`** token (same `api` guard as favourite routes; session cookies are not used).

### `GET /api/v1/leagues/:leagueId` → `{ seasons, season, statTypes }`

- **`seasons`** — all seasons for the league (`id`, `name`, `status`), ordered active → completed → inactive, then newest first within each group. Use for the season picker.
- **`season`** — full detail for the selected season (from `seasonId` query, or default active/newest): league, games (home/away teams), standings (with team), stats (type, player, team, relatedPlayer).
- **`season.standings`** — one row per **team in the league** for that season (not only teams that have played). Teams with no finished matches appear with zeroed stats (`played`, `points`, etc.). Ordered by `position` ascending.
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

**Game (detail)** — league + stats (with type, team, player, relatedPlayer).

### `GET /api/v1/teams/:id` → `{ team, leagues, statTypes }`

- **`team`** — `id`, `name`, `logoUrl`.
- **`leagues`** — typically one league (the team's `leagueId`), each with **`seasons`** the team participated in (games, standings row, and/or roster).
- **`statTypes`** — global stat type catalog for grouping player stats on the roster.

Each league entry's season includes:

- **`games`** — matches where this team is home or away (merged; not split into home/away arrays).
- **`standings`** — full league table for that season (all teams in the league), ordered by `position` ascending.
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

- **`player`** — `id`, `name`, `avatarUrl`, `country`.
- **`leagues`** — leagues the player belongs to (from `league_players` and/or stats), each with **`seasons`** for filtering in the UI.
- **`statTypes`** — global stat type catalog for grouping (same shape as league detail).

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
      "country": { "id": 1, "name": "Nigeria", "code": "ng" }
    },
    "statTypes": [
      { "id": 1, "name": "goals", "displayName": "Goals", "iconName": "soccer-ball", "category": "performance" }
    ],
    "leagues": [ "…league with seasons[] as above" ]
  }
}
```

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
| `teams` | optional array of `{ name: string (1–255), logo?: image file }` — each team `logo` is uploaded to Drive and stored as `logoUrl` on the team row (same as `POST /leagues/:leagueId/teams`) |

### `updateLeagueValidator` — `PUT /api/v1/leagues/:leagueId`

All fields optional: `name`, `description`, `gender`, `logo` (image file; stored as `logoUrl` via Drive upload).

### `createSeasonValidator` — `POST /api/v1/leagues/:leagueId/seasons`

| Field | Rules |
| --- | --- |
| `leagueId` | required; exists in `leagues` (also taken from URL for ownership) |
| `name` | string, 1–255 chars |
| `status` | `inactive` \| `active` \| `completed` |

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

### `updateGameValidator` — `PUT /api/v1/leagues/games/:id`

Optional: `homeScore`, `awayScore`, `currentMinute`, `status`, `playedAt`, `venueName`.

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

Optional: `relatedPlayerId`, `minute`, `isStoppageTime`, `value`, `numericValue`.

---

## Middleware

| Middleware | Meaning |
| --- | --- |
| `apiAuth` | Bearer access token (`api` guard). |
| `leagueOwner` | Authenticated user must own the league. Resolves `leagueId` from, in order: `params.leagueId` (URL), `leagueId` in body/query, or the parent game/stat row for `PUT /leagues/games/:id` and `PUT /leagues/stats/:id`. |

## Notes

- **Favourites:** Routes use US spelling (`/favorite`); the pivot table is `favourite_leagues`. `POST` attaches the league to the authenticated user; `DELETE` detaches. No `leagueOwner` check — any logged-in user can favourite any league. `GET /api/v1/leagues` sets `isFavourited` on leagues in `matches` when a Bearer token is sent.
- Logo uploads use Drive (`moveToDisk`); league/team logos are stored and exposed as URLs in `logoUrl`.
