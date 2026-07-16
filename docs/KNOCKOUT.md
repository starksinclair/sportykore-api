# Knockout stages (frontend)

In the product UI, **competition** maps to the existing **league** resource (`POST /leagues`, `GET /leagues/:id`). A season’s **stage(s)** decide what the hub shows: standings (`round_robin`) or bracket (`knockout`).

API tables: [ROUTES.md](../ROUTES.md). This doc is Expo/Match Center facing — no Expo code ships in this repo.

## Create competition / league

`POST /api/v1/leagues` still creates a league + first active season + optional teams. Use **`format`** so the first season is not hardcoded to round-robin.

| `format` | Stage created | Notes |
| --- | --- | --- |
| `league` (default) | `round_robin` named “League” | Standings seeded for any teams; same as before |
| `knockout` | `knockout` only (no round_robin) | Requires `knockout.config`; may auto-seed |

### League (round-robin) create

```http
POST /api/v1/leagues
```

```json
{
  "name": "Riverside Saturday League",
  "countryId": 1,
  "seasonName": "2026",
  "format": "league",
  "teams": [{ "name": "United" }, { "name": "Athletic" }]
}
```

Omit `format` — same as `"league"`.

### Knockout create

```json
{
  "name": "City Cup",
  "countryId": 1,
  "seasonName": "2026",
  "format": "knockout",
  "knockout": {
    "name": "Cup",
    "seed": true,
    "config": {
      "format": { "has_third_place": false },
      "ties": { "default": { "tie_format": "single" } }
    }
  },
  "teams": [
    { "name": "Seed 1" },
    { "name": "Seed 2" },
    { "name": "Seed 3" },
    { "name": "Seed 4" }
  ]
}
```

| Field | Rules |
| --- | --- |
| `format` | optional `league` \| `knockout` (default `league`) |
| `knockout` | **required** when `format` is `knockout` |
| `knockout.name` | optional stage name (default `"Cup"`) |
| `knockout.seed` | optional boolean (default `true`). When `true` and **≥ 2 teams** are sent, seeds the bracket in **array order** (index 0 = seed 1). Set `false` to create an unseeded stage and call seed later |
| `knockout.config` | same shape as create-stage `config` (see below) |

`tiebreaker` on create still applies to the league row but only matters for round-robin standings.

### Create response

```json
{
  "message": "League created successfully",
  "leagueId": 10,
  "seasonId": 5,
  "stageId": 12,
  "format": "knockout",
  "seeded": true
}
```

| Field | Meaning |
| --- | --- |
| `leagueId` / `seasonId` / `stageId` | Open the competition hub immediately |
| `format` | What the hub body should render |
| `seeded` | `true` if bracket ties/games were generated; `false` if knockout with `< 2` teams, or `knockout.seed: false` |

If `seeded` is `false` for a knockout competition, navigate to seed:

```
POST /api/v1/leagues/stages/:stageId/seed
{ "seededTeams": […ordered team ids…] }
```

### New season on an existing competition

```
POST /api/v1/leagues/:leagueId/seasons
```

Same `format` / `knockout` fields (no auto-seed on season create — add teams then `…/stages/:id/seed`). Response includes `stageId`, `format`, `seeded: false`.

### Competition screen: standings vs bracket

`GET /api/v1/leagues/:leagueId?seasonId=` now includes `season.stages[]` (`id`, `stageType`, `status`, `config`, …).

Suggested client logic:

1. Pick primary stage: prefer `knockout` if present, else `round_robin` (or let the user switch when both exist).
2. `round_robin` → show `season.standings` + fixtures.
3. `knockout` → `GET /leagues/stages/:id/bracket` instead of standings.
4. Shared chrome: teams, info, manage — unchanged.

Pure knockout seasons have **no** round_robin stage until something (e.g. `POST /leagues/games`) calls `ensureRoundRobinStage`. Don’t schedule cup ties via that endpoint — they come from seed / next-round.

---

## Mental model

```
seededTeams[] (ordered)  →  generateKnockoutPhase
                         →  stage_teams (seed 1…N)
                         →  entry-round ties (+ byes)
                         →  games for contested ties only

game → full_time / pens  →  advanceTie (updates series)
owner confirms           →  generateNextRound (winners pair)
```

**Boundary:** the client decides **who** is seed 1…N (create `teams[]` order or explicit seed call). The API never computes seeds from standings. Progression only moves **winners** — never re-seeds.

**Unit of competition:** a **tie** (series), not a single game. Formats: `single`, `two_legged`, `best_of`.

## Stages

| `stageType` | Role (v1) |
| --- | --- |
| `round_robin` | League table fixtures + standings |
| `knockout` | Bracket ties |
| `group` / `playoff` | Reserved — not generated yet |

Statuses: `upcoming` → `active` (after seed) → `completed` (final done; + third place if configured).

A season may have only round_robin, only knockout, or both (e.g. league then cup later via `POST …/stages`).

### Owner: create knockout stage (add-on cup)

```
POST /api/v1/leagues/:leagueId/stages
Body: { seasonId, name, sequence?, config }
→ 201 { message, id }
```

`config` shape:

```json
{
  "format": {
    "starting_round": "qf",
    "has_third_place": true
  },
  "ties": {
    "default": { "tie_format": "single" },
    "rounds": {
      "final": { "tie_format": "two_legged", "away_goals": false }
    }
  }
}
```

| Field | Notes |
| --- | --- |
| `format.starting_round` | Optional. Must match `nextPow2(N)` bracket size when seeding (e.g. 8 teams → `qf`). Omit to derive from seed count. |
| `format.has_third_place` | After SF, creates a `third_place` tie from SF losers. |
| `ties.default` | Required. `tie_format`: `single` \| `two_legged` \| `best_of`. |
| `ties.default.best_of` | Required when `best_of` (odd or even N). Server sets `targetWins = floor(N/2)+1`. |
| `ties.rounds[round]` | Optional per-round override. |

### Owner: seed

```
POST /api/v1/leagues/stages/:id/seed
Body: { seededTeams: number[] }   // length ≥ 2, unique, all in league
→ { message }
```

- `bracketSize = nextPow2(N)`; first `bracketSize − N` seeds get **bye** ties (`isBye`, `status: completed`, **no games**).
- Remaining seeds pair in order into contested ties; games created per format.
- Idempotent refuse: already seeded → `409`.

### Owner: next round

```
POST /api/v1/leagues/stages/:id/next-round
Body: { completedRound: "qf" | "sf" | … }
→ { message }
```

All ties in `completedRound` must be `completed` with a winner. Pairs winners by `bracketPosition`. Calling again when the next round already exists is a **no-op** (idempotent).

`completedRound: "final"` only marks the stage completed (when final ± third place are done) — it does not create further ties.

**There is no auto next-round** — the manage hub should show “Generate next round” once the current round is fully decided.

### Public reads

```
GET /api/v1/seasons/:seasonId/stages     → { data: Stage[] }
GET /api/v1/leagues/stages/:id/bracket   → { data: { stage, ties } }
GET /api/v1/leagues/:leagueId            → season includes stages[]
```

`ties` include nested `homeTeam` / `awayTeam` / `winnerTeam` and ordered `games` (by `leg`).

## Bracket UI transform

API returns a flat list of ties. Typical Expo layout:

1. Group ties by `round` (order: `r256`…`qf`→`sf`→`final`, keep `third_place` separate).
2. Sort each round by `bracketPosition`.
3. **Two-sided bracket:** left = positions `1…half`, right = `half+1…n` (or mirror SF losers into third-place row).
4. Bye tiles: show seed/team, no score, auto-advance badge.
5. Series score: prefer `tie.homeScoreAgg` / `awayScoreAgg` when present; else latest game scores.

Do not invent pairing — `generateNextRound` ownership of who faces whom is authoritative.

## Regular fixtures vs knockout games

| Create path | `stage_id` | `tie_id` |
| --- | --- | --- |
| `POST /leagues/games` (manage schedule) | Auto `round_robin` for that season | null |
| Tie lifecycle (`seed` / `next-round` / best-of extension) | Knockout stage | set |

Knockout games must **not** be created via `POST /leagues/games`. Standings only use round-robin stage games; tie games skip standings.

Game fields for knockout: `stageId`, `tieId`, `leg`, `round`, `bracketPosition`, `homePenaltyScore`, `awayPenaltyScore`, `winnerTeam`.

## Match Center: penalties + series

Status `penalty_shootout` is live (like other period statuses).

| Step | Endpoint |
| --- | --- |
| Enter pens (from `second_half` or `extra_time`) | `POST /games/:gameId/penalty-shootout` |
| Finish pens | `POST /games/:gameId/penalty-shootout/complete` `{ homePenaltyScore, awayPenaltyScore }` |

Complete requires unequal scores; sets `winnerTeamId`, status `full_time`, then `advanceTie` when `tieId` is set.

**Single** knockout: decisive FT (or pens if you entered shootout) completes the tie. Do not call FT with a draw and no pens — `advanceTie` needs a game winner.

**Two-legged:** both legs FT; aggregate on tie home/away. Level aggregate → second-leg `winnerTeamId` (usually pens) decides.

**Best-of:** first game created up front; each completed game may spawn the next leg until `targetWins`. Venue home **alternates**; series winner is by `winnerTeamId` vs `tie.homeTeamId`, not by "game home".

Show series context from the enclosing tie (`GET …/bracket` or game detail with `tieId`): format, `homeScoreAgg`/`awayScoreAgg`, `targetWins`, open leg.

## Manage hub checklist

- [ ] Create competition: `format` league vs knockout (+ `knockout.config` / teams order = seeds)
- [ ] After create: use `leagueId` / `seasonId` / `stageId` / `seeded` from response
- [ ] Competition hub: `season.stages` → standings **or** bracket
- [ ] Season stages list (`GET seasons/:id/stages`) — switch League vs Cup when both exist
- [ ] Add-on knockout on a league season: `POST …/stages` then seed
- [ ] Seed: ordered team picker when `seeded: false`
- [ ] Bracket view from `GET …/bracket`
- [ ] When round complete, confirm **Next round**
- [ ] Match Center: pens flow + series header when `game.tieId` set

## Out of scope (backend deferred)

- Group generation / best-thirds
- Playoffs via `source_stage_id`
- Auto next-round without owner confirm
