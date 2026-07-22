# Sportykore — Knockout stage (build prompt: backend + frontend)

Build the **knockout stage** as the reusable foundation for every bracketed format.
Knockout ships first and standalone, but it must be architected so that **groups** and
**playoffs** reuse the bracket core later with *zero changes* — the only thing that
differs between those formats is **how the entry round's teams are seeded**. Everything
from "here are N seeded teams" onward is shared.

## The one principle to hold the line on

> **Seeding is pluggable. Progression is shared.**

Seed source varies (manual draw now; group standings + best-thirds later; league
standings for playoffs later). The bracket generator and the round-to-round progression
must never contain seed-computation logic. Seeds are always *passed in* as an ordered list.

## Two structural ideas that drive this build

1. **The tie, not the game, is the bracket unit.** A matchup between two teams is a
   `tie`. A tie contains **1..N games** depending on its format. A single-leg tie has one
   game; a two-legged tie has two; a best-of-N tie has up to N. The bracket is read from
   `ties`; progression reads **tie** winners. This is what lets every tie format share one
   bracket.
2. **Tie formats are parameterized, not enumerated.** Don't hardcode "single / two-legged /
   best-of-3." Store a `tie_format` discriminator plus a number, and derive the win target.
   That makes best-of-3, best-of-5, best-of-7, or any N a single code path — the user can
   type a custom N (dynamic) or tap a preset (rigid), same stored shape.

## Scope of THIS build (v1)

- Knockout stage, with **all three tie formats live**: `single`, `two_legged`, and dynamic
  `best_of` (any N).
- **Byes** live — non-power-of-two entry counts are padded with byes to the top seeds.
- The `stages`, `stage_groups`, `stage_teams` tables ship now (shared schema) even though
  only knockout exercises them; `stage_groups` stays unused by knockout.
- `round_robin` becomes a real stage type via the backfill migration; standings logic is
  unchanged, just scoped by `stage_id`.
- Dormant hooks that remain: `stages.source_stage_id` (playoffs).

## Standings decision (settled)

**Keep the standings table.** A round-robin league is a season with one
`stage_type='round_robin'` stage. Standings gain `stage_id` + `stage_group_id`; the
live-compute query gains `WHERE stage_id = ?`. Knockout stages use no standings (a bracket
is read from `ties`/`games`). Backfill every existing season as a single `round_robin`
stage and stamp `stage_id` onto its games and standings.

---

# BACKEND (AdonisJS 7, Neon Postgres, Lucid, VineJS)

## 1. Migrations

### `stages` (new)
```
id
season_id        FK seasons, ON DELETE CASCADE, NOT NULL
name             varchar(255) NOT NULL
stage_type       enum(round_robin, group, knockout, playoff) NOT NULL
sequence         int NOT NULL DEFAULT 1
status           enum(upcoming, active, completed) NOT NULL DEFAULT 'upcoming'
source_stage_id  FK stages(id) ON DELETE SET NULL, NULL      -- DORMANT (playoffs)
config           jsonb NOT NULL DEFAULT '{}'
created_at, updated_at
index (season_id, sequence)
```

### `stage_groups` (new — ships now, unused by knockout)
```
id
stage_id   FK stages, ON DELETE CASCADE
name       varchar(120) NOT NULL
sequence   int NOT NULL DEFAULT 1
index (stage_id)
```

### `stage_teams` (new — unified enrollment for ALL formats)
```
id
stage_id        FK stages, ON DELETE CASCADE
team_id         FK teams,  ON DELETE CASCADE
stage_group_id  FK stage_groups, ON DELETE SET NULL, NULL   -- groups only
seed            int NULL                                     -- bracket seeding
unique (stage_id, team_id)
index (stage_id, stage_group_id)
```

### `ties` (new — the bracket unit)
```
id
stage_id         FK stages, ON DELETE CASCADE, NOT NULL
round            enum(r256,r128,r64,r32,r16,qf,sf,final,third_place) NOT NULL
bracket_position int NOT NULL                 -- slot within the round (1..N/2)
home_team_id     FK teams, ON DELETE SET NULL, NULL   -- null side = bye / TBD
away_team_id     FK teams, ON DELETE SET NULL, NULL
tie_format       enum(single, two_legged, best_of) NOT NULL DEFAULT 'single'
best_of          smallint NULL               -- the N; null unless best_of
target_wins      smallint NULL               -- derived: floor(best_of/2)+1
away_goals       boolean NOT NULL DEFAULT false        -- two_legged tiebreak toggle
is_bye           boolean NOT NULL DEFAULT false
home_score_agg   smallint NULL               -- cache: aggregate goals OR win count
away_score_agg   smallint NULL
winner_team_id   FK teams, ON DELETE SET NULL, NULL     -- resolved tie winner
status           enum(pending, in_progress, completed) NOT NULL DEFAULT 'pending'
created_at, updated_at
unique (stage_id, round, bracket_position)
index (stage_id, round, bracket_position)
```

### `games` (alter)
```
stage_id           FK stages, ON DELETE CASCADE
stage_group_id     FK stage_groups, ON DELETE SET NULL, NULL
tie_id             FK ties, ON DELETE CASCADE, NULL       -- LIVE: bracket games belong to a tie
leg                smallint NULL                          -- LIVE: game number within the tie (1..N)
round              enum(...same as ties...) NULL          -- denormalized from tie for easy reads
bracket_position   int NULL                               -- denormalized from tie
home_penalty_score smallint NULL
away_penalty_score smallint NULL
winner_team_id     FK teams, ON DELETE SET NULL, NULL     -- winner of THIS game (leg)
index (tie_id, leg)
```
Note: `winner_team_id` on **games** is the winner of that single game (used for best-of
win-counting and as the tie winner in single-leg). `winner_team_id` on **ties** is the
resolved winner of the whole matchup.

### `games.status` (alter enum — add shootout state)
```
scheduled, first_half, half_time, second_half, extra_time,
penalty_shootout,  -- NEW: live shootout in progress
full_time, cancelled, postponed, paused
```

### `standings` (alter)
```
stage_id        FK stages, ON DELETE CASCADE
stage_group_id  FK stage_groups, ON DELETE SET NULL, NULL
index (stage_id, stage_group_id)
```

### Backfill migration (run last)
Per existing season: create one `round_robin` stage, then stamp `stage_id` on that
season's `games` and `standings`. No deletes.

## 2. Bracket helpers (`app/lib/bracket_rounds.ts`)

Round value **is** the team count — progression is deterministic with no config lookup.
```
ROUND_SIZE = { r256:256, r128:128, r64:64, r32:32, r16:16, qf:8, sf:4, final:2 }

roundSize(round)      -> ROUND_SIZE[round]
roundFromSize(n)      -> key whose value === n         (throws if n not a bracket size)
nextRound(round)      -> roundFromSize(roundSize(round) / 2)
nextPow2(n)           -> smallest power of two >= n     (for bye padding)
targetWins(bestOf)    -> Math.floor(bestOf / 2) + 1     (bo3->2, bo5->3, bo7->4)
```
`third_place` is a sibling of `final` (size 2), never produced by `nextRound`.

## 3. Byes — bracket sizing

Given `N` seeded teams:
```
bracketSize  = nextPow2(N)
byes         = bracketSize - N
entryRound   = roundFromSize(bracketSize)     // e.g. 6 teams -> size 8 -> 'qf', 2 byes
entryTies    = bracketSize / 2
```
Bye distribution (simple, predictable for grassroots): the **top `byes` seeds** each get a
bye tie (`is_bye=true`, opponent null, auto-advanced); the remaining `N - byes` teams pair
sequentially into contested ties. A bye tie is created already resolved: `winner_team_id =
the present team`, `status='completed'`, **zero games**. So progression treats it as a
finished tie with no special-casing downstream.

If the caller enrolls exactly a power of two, `byes=0` and every entry tie is contested —
the clean case.

## 4. Resolvers (the reusable core)

### `generateKnockoutPhase(stage, seededTeams, startingRound?)`
- `seededTeams`: ordered `team_id[]`, passed in (the pluggable seam — never computed here).
- Compute `bracketSize`, `byes`, `entryRound` from `seededTeams.length`. If `startingRound`
  is supplied, validate `roundSize(startingRound) === bracketSize` (or ≥ N with byes);
  otherwise derive it.
- Enroll teams into `stage_teams` with `seed = index+1`.
- Create entry-round **ties**: `byes` bye ties for the top seeds (auto-resolved), then
  contested ties by sequential pairing of the remaining ordered teams. Each contested tie
  gets its format from config (`ties.rounds[entryRound] ?? ties.default`) and its
  `best_of`/`target_wins`/`away_goals` filled accordingly.
- For each contested tie, **create its initial game(s)** (see §5).
- `stage.status = 'active'`.

### `generateNextRound(stage, completedRound)`
- **Guard**: if `nextRound(completedRound)` ties already exist, no-op (idempotent).
- **Assert** every tie in `completedRound` has `status='completed'` (bye ties already are).
- Pair tie winners by `bracket_position` (1&2 -> next tie 1, ...). Create next-round ties
  (+ their initial games) using that round's config format.
- **Third-place branch**: if `completedRound==='sf'` and `config.format.has_third_place`,
  also create a `third_place` tie between the two SF losers.
- When `final` (and `third_place`) ties are completed, `stage.status='completed'`.

Both resolvers read/write **ties**; groups & playoffs call `generateKnockoutPhase`
identically with a seeded list computed from standings.

## 5. Tie & series lifecycle (`app/services/tie_resolver.ts`)

This is where the three formats live. Two functions:

### `createTieGames(tie)` — initial games when a tie is created
- `single`: create 1 game, `leg=1`.
- `two_legged`: create 2 games, `leg=1` (home first leg) and `leg=2` (venues swapped).
- `best_of`: create 1 game, `leg=1`. (Best-of games are created **on demand** — never
  pre-create all N, since a bo5 that goes 3–0 plays only 3.)
Bye ties create **no** games.

### `advanceTie(tie)` — called after any game in the tie reaches `full_time`
Recompute the tie's cached score and decide if it's resolved:
- **single**: tie winner = the game's `winner_team_id` (decisive score, or penalties). Done.
- **two_legged**: sum both legs' goals per team into `home_score_agg`/`away_score_agg`.
  If both legs `full_time`: higher aggregate wins. If level and `away_goals` → away-goals
  rule; if still level, the **2nd leg** should have gone to ET then penalties (its
  `winner_team_id` from the shootout decides the tie). Set tie winner + `completed`.
- **best_of**: count each side's game wins into `home_score_agg`/`away_score_agg`. If a
  side reached `target_wins` → tie winner + `completed`. Else if `leg < best_of` → create
  the next game (`leg+1`) and set tie `in_progress`. **Even-N safeguard**: if all `best_of`
  games are played and wins are tied (possible only when `best_of` is even), resolve by
  aggregate goals across the series; if still tied, the final game goes to penalties.

`advanceTie` runs inside the game-result flow (below), so best-of series self-extend and
every format resolves the tie the moment it's decided.

## 6. Winner resolution + penalties (per game)

Each **game** resolves its own winner (this feeds best-of win counts and single-leg tie
winners):
- Decisive score at terminal state → `game.winner_team_id` from the higher score.
- Level knockout game → cannot close as `full_time` without a path. Organizer chooses:
  - **Extra time** → `extra_time`; decisive after ET → winner from score.
  - **Penalties** → `penalty_shootout`; on completion store `home_penalty_score` /
    `away_penalty_score`, derive `game.winner_team_id`, set `full_time`.
- Penalties are reachable **after full time OR after extra time** (leagues differ; don't
  force ET first).
- After a game hits `full_time`, call `advanceTie(game.tie)`.

Match Center, stats, the score/stat atomicity invariant, and SSE are otherwise untouched.

## 7. Config + validators (dynamic tie formats)

Knockout `config`:
```jsonc
{
  "format": { "starting_round": "qf", "has_third_place": true },
  "ties": {
    "default": { "tie_format": "best_of", "best_of": 5 },   // dynamic N
    "rounds":  { "final": { "tie_format": "single" } }        // per-round override
  }
}
```
- `knockoutConfigValidator`: `tie_format` in `single|two_legged|best_of`;
  when `best_of`, require `best_of` integer in a sane range (e.g. **1–15**) — this is the
  dynamic knob; `target_wins` is **derived server-side**, never trusted from the client.
  `two_legged` may carry `away_goals` boolean.
- **Presets vs custom** are a UI concern, not a schema one — the same `{tie_format,best_of}`
  shape stores a preset (best-of-3) or a custom value (best-of-6). One validator covers both.
- Even `best_of` is allowed (grassroots may want it) but triggers the even-N safeguard in
  `advanceTie`; recommend the UI nudge toward odd but not forbid even.
- Reject `ties`/bracket fields on non-knockout stage types.

## 8. Endpoints, middleware, transformers

Under `apiAuth` + `leagueOwner` (extend it to resolve `leagueId` via a stage's
`season → league`, as it already does for games/stats).
```
POST /leagues/:leagueId/stages                  create knockout stage                 (owner)
POST /leagues/stages/:id/seed                    body {seededTeams[]} -> generateKnockoutPhase (owner)
POST /leagues/stages/:id/next-round              body {completedRound} -> generateNextRound    (owner)
GET  /leagues/stages/:id/bracket                 ties (with games) ordered round,bracket_position (public)
GET  /seasons/:seasonId/stages                   stages by sequence                    (public)
```
- Game-result flow already exists; extend it to accept penalty scores + call `advanceTie`.
- Transformers: `StageTransformer`, `TieTransformer` (`round, bracketPosition, tieFormat,
  bestOf, isBye, homeTeam, awayTeam, homeScoreAgg, awayScoreAgg, winnerTeam, status, games[]`),
  and extend `GameTransformer` with `leg`, `round`, `winnerTeam`, penalty scores.
  Bracket read returns ties with nested games; `preload` accordingly.

## 9. Backend acceptance tests

- **Clean 8-team**: seed 8 at qf (byes=0) → play qf incl. one penalty decision → next
  round → sf → final + third_place → stage completed, every tie has a winner.
- **Byes**: seed 6 → bracketSize 8, 2 byes to top seeds → assert bye ties auto-completed
  with no games → generate qf winners feed sf correctly.
- **Best-of dynamic**: a bo5 tie → assert games created on demand (3–0 stops at 3 games;
  3–2 plays 5) → tie winner at target_wins.
- **Two-legged**: a two_legged tie → aggregate decides; level aggregate resolves via 2nd-leg
  penalties.
- **Idempotency**: second `next-round` call is a no-op.

---

# FRONTEND (React Native, Expo, React Query + persistQueryClient + AsyncStorage)

Bracket components are **format-agnostic** — they render from `ties` (with nested games)
grouped by `round`/`bracket_position`, so groups/playoffs reuse them unchanged.

## 1. Two-sided bracket view (public)

- **Split the entry round's ties into two halves by `bracket_position`.** The **first
  half** of positions renders on the **left**; the **second half** on the **right**.
  Within a side the first tie is the top pairing, the next below it, and so on (sequential
  pairing the backend already produced). Each subsequent round steps **inward**; the
  **final** sits in the middle fed by each side's last winner. `third_place` renders as a
  small detached match near the final.
- **The left/right split is purely a UI transform** — the backend stores only sequential
  `bracket_position`; the client computes sides.
- Each tie cell shows both teams and the **series/aggregate score** appropriate to its
  format: single → the scoreline (`2–1`, or `1–1 (4–3 pens)`); two-legged → aggregate plus
  per-leg scores; best-of → the **series score** (e.g. `2–1` games) with a `best of N`
  label and per-game results on expand. Winner highlighted.
- **Bye ties** render as the team over a "BYE" placeholder, already advanced.
- Empty/future slots render as "awaiting". Scrolls cleanly on a phone; caches offline.

## 2. Competition screen switches on `stage_type`

One screen: `round_robin` → standings + fixtures (existing); `knockout` → bracket. Multiple
stages → stage tabs in `sequence` order. Build the switch now (only round_robin + knockout
exist today) so groups→knockout is one screen later.

## 3. Match Center — penalties + series context

- Same Match Center as any game, plus: a **"go to penalties"** action available **after
  full time AND after extra time** (in addition to the existing "enter extra time"). It
  moves the game to `penalty_shootout`, takes penalty scores, confirms the winner, posts
  them; backend sets the game winner and calls `advanceTie`.
- **Series context** for multi-leg ties: show "Leg 1 of 2" / "Game 3 of 5 · series 2–2" so
  the organizer knows the stakes of the current game. After a best-of game, if the series
  isn't decided, the next game appears automatically (backend created it via `advanceTie`).

## 4. Organizer stage management (manage hub)

- **Create knockout stage**: name, `starting_round` (or "auto from team count" when byes
  apply), `has_third_place` toggle, and the **tie-format control** — see below.
- **Tie-format control (dynamic, not rigid)**: preset chips for the common cases
  (**Single match**, **Home & away**, **Best of 3**) *plus* a **custom** option with a
  number stepper for **Best of N** (any N in range). Optionally a per-round override list
  ("customize by round") so, e.g., the final can differ from earlier rounds. All of it
  writes the same `{tie_format, best_of?}` config shape — presets and custom are identical
  under the hood.
- **Seed the entry round**: manual drag-order draw now; the component API must accept an
  externally-supplied pre-seeded list so group/playoff auto-seeding feeds it later
  unchanged. Show the resulting bye count when the enrolled total isn't a power of two.
- **Generate next round**: after a round completes, a preview of the pre-filled pairings
  the organizer confirms before committing (assisted, not automatic).

## 5. The seedSource boundary (make reuse cheap)

Every path that produces the seeded list sits behind one `seedSource` boundary. MVP =
manual draw. The same seeding/bracket components accept an externally-computed ordered
list so groups (standings + best-thirds) and playoffs (league standings) reuse them with
no changes. Seed computation must never leak into the bracket UI.

---

# Dormant hooks (ship, don't execute)

- `stages.source_stage_id` — playoffs point a knockout at its feeder stage.
- `stage_groups`, `stage_teams.stage_group_id` — used by groups, not knockout.

# Deferred (out of scope for this build)

- **Groups** — schema ships now; group generation, per-group standings, and the qualifier
  resolver (winners + runners-up + best-thirds, auto/manual) come next.
- **Playoffs** — a thin composition: feeder stage (`source_stage_id`) + a knockout seeded
  from its standings. Reuses everything above; only the seed source differs.
- **Bracket auto-progression** — MVP is organizer-triggered preview-then-confirm.

# Now included in v1 (previously deferred)

- **Byes** — power-of-two padding to the top seeds, auto-resolved bye ties.
- **Two-legged and best-of-N ties** — all live, best-of dynamic (any N) via `{tie_format,
  best_of}` with derived `target_wins`; games created on demand; even-N safeguard.
- **Ties as the bracket unit** — `ties` table + `tie_id`/`leg` on games are live.
