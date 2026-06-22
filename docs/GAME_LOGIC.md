# Game logic — how it works (Sportykore API)

This document describes the **current** implementation: match lifecycle, live scoring, stats, standings, events, SSE, and how data is read back via the API.

---

## 1. Overview

A **game** belongs to a **league** and **season**, has a **home team** and **away team**, a **status** (lifecycle), **scores**, timing timestamps, and optional **stats** (goals, cards, etc.).

Three parallel concerns:

| Concern | Source of truth | Updated how |
|--------|-----------------|-------------|
| **Match clock** | `games.status` + `*StartedAt` timestamps | `GameTimeService` via match-control routes |
| **Score on the board** | `games.home_score` / `games.away_score` | Live `POST .../score`, or `POST .../full-time`, or league-owner `PUT .../games/:id` |
| **Player stats** | `stats` table | Live score creates placeholders; accredit/manual CRUD; **does not auto-sync score** on manual stat create |
| **League table** | `standings` table (cached) | Event-driven `StandingService.recalculate` on `GameUpdated` |

**Important:** Standings use **game scores**, not a count of goal stats. Stats and scores can diverge if managed incorrectly.

---

## 2. Data model

### 2.1 `games` table

| Field | Role |
|-------|------|
| `league_id`, `season_id` | Scope |
| `home_team_id`, `away_team_id` | Participants (must differ) |
| `home_score`, `away_score` | Nullable integers; treated as `0` in standings if null |
| `played_at` | Kickoff instant (UTC) |
| `status` | Lifecycle (see §3) |
| `first_half_duration`, `second_half_duration` | Default 45 each |
| `extra_time_duration` | Optional |
| `first_half_started_at`, `second_half_started_at`, `extra_time_started_at` | Clock anchors |
| `paused_at`, `paused_from_status` | Pause metadata |
| `venue_name` | Optional |

**Statuses** (`app/types/game_status.ts`):

`scheduled` → `first_half` → `half_time` → `second_half` → (`extra_time`?) → `full_time`

Also: `paused`, `postponed`, `cancelled`.

**Live statuses** (client may run local clock): `first_half`, `second_half`, `extra_time`, `paused`.

### 2.2 `stats` table

Each stat links: `game_id`, `league_id`, `season_id`, `team_id`, `stat_type_id`, optional `player_id`, `related_player_id`, `minute`, etc.

**Stat types** (seeded): `goals`, `own_goal`, `assists`, `yellow_card`, `red_card`, `saves`, `shots_on_target`, `fouls_conceded`, `substitution_on`, `substitution_off`.

### 2.3 `standings` table

One row per `(season_id, team_id)` with: `position`, `played`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, `goal_difference`, `points`, `form` (currently always `null` — never computed).

Seeded with zeros when:

- A league is created with teams (`LeagueService.createWithSeason`)
- A team is added to a league with an active season (`TeamsController.store`)

---

## 3. Match lifecycle (status machine)

Implemented in `app/services/game_time_service.ts`, exposed via `GameTimeController`.

```
scheduled / postponed
    │ POST start-first-half
    ▼
first_half
    │ POST half-time
    ▼
half_time
    │ POST start-second-half
    ▼
second_half ──POST extra-time──► extra_time
    │                                  │
    └──────── POST full-time ──────────┘
                    ▼
               full_time
```

| Action | Allowed from | Effect |
|--------|--------------|--------|
| `start-first-half` | `scheduled`, `postponed` | `status = first_half`, `firstHalfStartedAt = now` |
| `half-time` | `first_half` | `status = half_time` |
| `start-second-half` | `half_time` | `status = second_half`, `secondHalfStartedAt = now` |
| `extra-time` | `second_half` | `status = extra_time`, `extraTimeStartedAt = now` |
| `pause` | `first_half`, `second_half`, `extra_time` | `status = paused`, saves `pausedFromStatus` + `pausedAt` |
| `resume` | `paused` | Restores prior status; **shifts** period start time forward by pause duration |
| `full-time` | `second_half`, `extra_time` | `status = full_time`, sets final `homeScore` / `awayScore` from request body |

Each transition saves the game and broadcasts SSE `status_changed` on channel `games/{gameId}`.

**League owner** can also `PUT /api/v1/leagues/games/:id` with any valid `status` and scores — this bypasses the formal clock workflow (backdoor for admins).

---

## 4. Match clock (display minute)

**Not stored in DB every minute.** Computed on read in `GameTimeService.calculateCurrentMinute()` and exposed as `currentMinute` on `GameTransformer`.

Logic:

- **First half:** minutes since `firstHalfStartedAt`
- **Half time:** frozen at `firstHalfDuration` (default 45)
- **Second half:** `firstHalfDuration` + minutes since `secondHalfStartedAt`
- **Extra time:** both half durations + minutes since `extraTimeStartedAt`
- **Paused:** minute frozen at value when pause began
- **Full time:** `firstHalfDuration + secondHalfDuration` (extra time not added to displayed minute at FT)
- **Scheduled / cancelled / postponed:** `0`

Clients should use SSE `status_changed` + local `setInterval` for live display (see `docs/CHANGE_GAME.md`).

---

## 5. Scoring (hybrid live flow)

Primary live path: `GameScoreService` via `POST /api/v1/games/:gameId/score`.

### 5.1 Increment goal

In a DB transaction:

1. Bump `homeScore` or `awayScore` on the game
2. Create a **placeholder** stat: `stat_type = goals`, `player_id = null`, `minute = calculateCurrentMinute(game)`

Then SSE `score_updated` with `{ homeScore, awayScore }`.

Saving the game triggers `Game.afterSave` → `GameUpdated` event (reason `'result'`).

### 5.2 Decrement goal

In a transaction:

1. Decrement score (floor at 0)
2. Delete the most recent **unaccredited** goal placeholder for that team

SSE `score_updated`. Triggers `GameUpdated`.

### 5.3 Accredit goal

`PATCH /api/v1/games/:gameId/stats/:statId/accredit`

Body: `{ playerId, assistPlayerId?, isOwnGoal, minute }`

- Only works on placeholder goals (`playerId === null`, type `goals`)
- Sets scorer; if `isOwnGoal`, changes stat type to `own_goal` (score is **not** flipped — operator must have incremented the benefiting side)
- Optionally creates an `assists` stat for `assistPlayerId`
- SSE `stat_accredited`
- Stat `afterSave` → `GameUpdated` (reason `'stat'`) — **standings still use game score, not stats**

### 5.4 Full time

`POST /api/v1/games/:gameId/full-time` with `{ homeScore, awayScore }` confirms final score (may differ from live tally if corrected at whistle).

Sets `status = full_time`. `Game.afterSave` fires `GameUpdated` when status becomes `full_time`.

### 5.5 Manual score / admin paths

| Route | Who | Notes |
|-------|-----|-------|
| `PUT /api/v1/leagues/games/:id` | League owner | Can set `homeScore`, `awayScore`, `status` directly |
| `POST /api/v1/leagues/games` | League owner | Can create game with `status: full_time` and scores pre-filled |

---

## 6. Stats (non-live / manual)

### 6.1 Create stat

`POST /api/v1/leagues/stats` — league owner only.

`StatService.validateForCreate` checks:

- Game exists and matches `leagueId` / `seasonId`
- `teamId` is home or away in that game
- Player has **active** `league_players` row for that team/season
- Related player (e.g. assist) is on an active roster for one of the match teams

**Does not update `homeScore` / `awayScore`.** Docs say update game separately.

### 6.2 Update stat

`PUT /api/v1/leagues/stats/:id` — minute, related player, etc. Triggers `GameUpdated` via `Stat.afterSave`.

### 6.3 Delete stat

`DELETE /api/v1/leagues/stats/:id` — deletes stat, manually dispatches `GameUpdated`. **Does not decrement game score.**

---

## 7. Standings

### 7.1 Rules

From `StandingService.recalculate`:

- Only games with `status = 'full_time'` count
- **Win:** 3 pts | **Draw:** 1 pt | **Loss:** 0 pts
- **Tiebreak order:** points → goal difference → goals for
- Null scores treated as `0`

`form` is never updated by recalculation.

### 7.2 When recalculation runs

Registered in `start/events.ts`:

```
GameUpdated → UpdateStandings listener → StandingService.recalculate (home + away)
```

**`GameUpdated` is dispatched when:**

| Trigger | Reason | Standings effect |
|---------|--------|------------------|
| `homeScore` or `awayScore` changes on game save | `result` | Recalc runs; live games excluded until `full_time` |
| `status` changes **to** `full_time` | `result` | Game now included |
| Any stat save | `stat` | Recalc runs; numbers unchanged unless score also changed |
| Stat delete (controller) | `stat` | Same |

**Does NOT fire when:**

- Status changes **from** `full_time` to `cancelled` / `postponed`
- Game is **deleted**
- Only non-score stat fields change without save hook... (updates still fire on stat save)

### 7.3 Initial rows

- `LeagueService.createWithSeason` → `ensureForTeams` (zeroed rows + positions)
- `TeamsController.store` → `ensureForTeams` for active season if exists
- `SeasonsController.store` → **no** standing seeding

### 7.4 How standings are read

- `GET /api/v1/leagues/:leagueId?seasonId=` → `season.standings` preloaded; **all teams in the league** are included (missing rows are seeded with zeros on read), ordered by `position`
- `GET /api/v1/teams/:id` → full league table per season via `TeamService`

---

## 8. Events & real-time (Transmit SSE)

Channel: **`games/{gameId}`** (subscribe via Adonis Transmit).

| Event `type` | When | Payload (key fields) |
|--------------|------|----------------------|
| `status_changed` | Clock transitions | `status`, timestamps, scores |
| `score_updated` | Live +/- | `homeScore`, `awayScore` |
| `stat_accredited` | Goal accredited | `statId` |
| `game_updated` | After standings listener | `reason`, `gameId` — **no standings payload** |

Clients watching the **league table** must refetch `GET /leagues/:id` (or team detail) on `game_updated` / FT — standings are not pushed inline.

---

## 9. API routes & authorization

### 9.1 Public read

- `GET /api/v1/games/:id` — game detail + stats
- `GET /api/v1/leagues/:leagueId` — season games + standings
- `GET /api/v1/leagues` — match day feed (timezone-aware)

### 9.2 League owner (`leagueOwner` middleware)

Creates/updates/deletes games and stats; manages league structure.

Resolves `leagueId` from URL param, body, or parent game/stat row.

### 9.3 Match control (`teamOwner` middleware)

Clock + live score routes under `/api/v1/games/:gameId/*`.

Authorized if user is:

- League owner (`leagues.user_id`), **or**
- Home team creator (`teams.added_by`), **or**
- Away team creator

Also: `apiAuth` + `gameUpdateThrottle`.

---

## 10. End-to-end flows

### 10.1 Typical live match

```
1. League owner creates fixture     POST /leagues/games
2. Operator starts match            POST /games/:id/start-first-half
3. Goal scored                      POST /games/:id/score { team, increment }
   → score + placeholder stat + SSE score_updated
4. Accredit scorer                  PATCH /games/:id/stats/:statId/accredit
5. Half time / second half          POST half-time, start-second-half
6. Full time                        POST /games/:id/full-time { homeScore, awayScore }
   → status full_time → GameUpdated → standings recalc → SSE game_updated
```

### 10.2 Backdated result (no live)

```
POST /leagues/games  { status: 'full_time', homeScore, awayScore, ... }
  OR
PUT /leagues/games/:id  { status: 'full_time', homeScore, awayScore }
```

### 10.3 Manual stat entry (cards, etc.)

```
POST /leagues/stats  { gameId, playerId, statTypeId, teamId, minute, ... }
```

No score change. Standings listener runs but table unchanged.

---

## 11. Key files

| Area | Path |
|------|------|
| Routes | `start/routes.ts` |
| Game CRUD | `app/controllers/games_controller.ts` |
| Match clock | `app/controllers/game_time_controller.ts`, `app/services/game_time_service.ts` |
| Live score | `app/controllers/game_score_controller.ts`, `app/services/game_score_service.ts` |
| Stats | `app/controllers/stats_controller.ts`, `app/services/stat_service.ts` |
| Standings | `app/services/standing_service.ts`, `app/listeners/update_standings.ts` |
| Models / hooks | `app/models/game.ts`, `app/models/stat.ts` |
| Event wiring | `start/events.ts`, `app/events/game_updated.ts` |
| Transformers | `app/transformers/game_transformer.ts`, `standing_transformer.ts` |
| Auth | `app/middleware/league_owner_middleware.ts`, `team_owner_middleware.ts` |

Related docs: `ROUTES.md`, `docs/CHANGE_GAME.md`, `docs/MANAGE_LEAGUE.md`, `docs/hybrid-scoring-prompt.md`.

---

## 12. Known gaps (current behavior)

These are implementation realities, not spec:

1. **Deleting a FT game** does not recalculate standings — stale table until manual fix.
2. **Voiding FT** (`full_time` → `cancelled`) does not fire `GameUpdated` — result stays on table.
3. **Deleting a goal stat** does not decrement game score — stats vs table can diverge.
4. **`form`** column exists but is never populated.
5. **New seasons** do not auto-seed standing rows for all teams.
6. **Standings SSE** signals change but does not include table data.
7. **Stat-triggered recalc during live play** is redundant work (game not FT yet).
8. **Own goals** rely on operator pressing increment for the **benefiting** side; accreditation only changes stat metadata.

---

## 13. Architecture diagram

```
                    ┌─────────────────┐
                    │   games table   │◄── scores, status, clock timestamps
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
 GameTimeService      GameScoreService      GamesController
 (clock routes)       (live +/-)            (CRUD / admin PUT)
         │                   │
         │ save              │ save + stats
         ▼                   ▼
    Game.afterSave ──────────┴──────────► GameUpdated event
                             ▲
                    Stat.afterSave / delete
                             │
                             ▼
                    UpdateStandings listener
                             │
                             ▼
                    StandingService.recalculate
                             │
                             ▼
                    standings table (cache)
                             │
         GET /leagues/:id ───┴──► SeasonTransformer → standings[]
```

---

*Last aligned with codebase: stored standings + event-driven recalculation.*
