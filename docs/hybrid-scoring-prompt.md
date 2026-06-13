# Hybrid Scoring System Implementation Prompt

> **Backend (this repo):** Implemented — `POST /games/:gameId/score`, `PATCH /games/:gameId/stats/:statId/accredit`, nullable `stats.player_id` for unaccredited placeholders, `StatTransformer.isUnaccredited`, SSE `score_updated` / `stat_accredited`. See [ROUTES.md](../ROUTES.md).
>
> **Mobile (React Native):** UI/hooks below are for the Expo app — not in this repository.

## Context

We are building a soccer league management platform using AdonisJS (backend) and React Native Expo (frontend). We already have:

| Already Exists | Detail |
|---|---|
| `games` table | Has `status`, `homeScore`, `awayScore`, `currentMinute` columns |
| `stats` table | Has `playerId`, `teamId`, `statTypeId`, `minute`, `numericValue`, `relatedPlayerId` |
| `stat_types` table | Has `goal`, `assist`, `own_goal`, `yellow_card`, `red_card` types |
| `GameUpdated` event | Fires with reason `'result'` or `'stats'` when game data changes |
| `UpdateStandings` listener | Recalculates standings and broadcasts via SSE |
| Transmit SSE | Already configured, broadcasting to `games/:gameId` channel |
| `TeamOwnerMiddleware` | Both league owner and team owner pass this middleware |
| `useLiveMinute` hook | Calculates live match minute from stored timestamps |
| `GameTransformer` | Already serializes game data with `forDetail` variant |
| `StatTransformer` | Already serializes stat data |

---

## Overview

Replace the current manual score input with a **hybrid scoring system** where:

- Admin increments or decrements score using `+` / `−` buttons
- Score updates **immediately** via SSE — no page refresh
- A player accredit section is **always visible on the same screen** — zero extra navigation or modal clicks
- Admin selects scorer and optional assist from a combined list of both teams
- Admin can skip accrediting — score updates but an unaccredited placeholder is stored
- Unaccredited goals can be accredited later from a Goals tab

---

## Screen Layout

```
┌─────────────────────────────────────┐
│   Riverside United  2 - 1  Harborview   │
│                  [67']              │
├─────────────────────────────────────┤
│  HOME                      AWAY     │
│  [−]  [+]                [−]  [+]  │
├─────────────────────────────────────┤
│  SELECT SCORER                      │
│  ── Riverside United ──             │
│  [ ] Marcus Kim  #10                │
│  [ ] John Doe    #7                 │
│  ── Harborview Athletic ──          │
│  [ ] Elena Martinez  #5             │
│  [ ] Tom Walsh  #9                  │
├─────────────────────────────────────┤
│  ASSIST (optional) — appears after  │
│  scorer is selected                 │
│  ── Riverside United ──             │
│  [ ] Marcus Kim  #10                │
│  ...                                │
├─────────────────────────────────────┤
│  [ ] Own Goal          Minute: [67] │
│  [Log Goal]   [Skip — Score Only]   │
└─────────────────────────────────────┘
```

---

## Backend Changes

### 1. Score Controller

Create `app/controllers/game_score_controller.ts`:

**`POST /games/:gameId/score`**

Request body:
```ts
{
  team: 'home' | 'away'
  action: 'increment' | 'decrement'
}
```

Logic:
- `increment` → add 1 to the correct team score
- `decrement` → subtract 1 from the correct team score, minimum 0 using `Math.max(0, score - 1)`
- On `increment` → create an **unaccredited placeholder stat**:
  ```ts
  await Stat.create({
    gameId: game.id,
    leagueId: game.leagueId,
    seasonId: game.seasonId,
    teamId: team === 'home' ? game.homeTeamId : game.awayTeamId,
    statTypeId: GOAL_STAT_TYPE_ID,
    playerId: null,           // null = unaccredited
    minute: game.currentMinute,
    numericValue: 1,
  })
  ```
- On `decrement` → delete the most recent unaccredited (`playerId = null`) goal stat for that team:
  ```ts
  await Stat.query()
    .where('game_id', game.id)
    .where('team_id', teamId)
    .whereNull('player_id')
    .where('stat_type_id', GOAL_STAT_TYPE_ID)
    .orderBy('created_at', 'desc')
    .first()
    .then((stat) => stat?.delete())
  ```
- After every action → broadcast via Transmit SSE to `games/:gameId`:
  ```ts
  transmit.broadcast(`games/${game.id}`, {
    type: 'score_updated',
    homeScore: game.homeScore,
    awayScore: game.awayScore,
  })
  ```
- Fire `GameUpdated` event with reason `'result'` so standings recalculate

### 2. Stat Accredit Endpoint

Add `accredit` action to existing `GameStatsController`:

**`PATCH /games/:gameId/stats/:statId/accredit`**

Request body:
```ts
{
  playerId: number
  assistPlayerId?: number | null
  isOwnGoal: boolean
  minute: number
}
```

Logic:
- Find the stat by `statId`
- Update `playerId`, `minute`, and `statTypeId` (switch to `own_goal` type if `isOwnGoal`)
- If `assistPlayerId` provided → create a **separate assist stat**:
  ```ts
  await Stat.create({
    gameId: stat.gameId,
    leagueId: stat.leagueId,
    seasonId: stat.seasonId,
    teamId: stat.teamId,
    statTypeId: ASSIST_STAT_TYPE_ID,
    playerId: assistPlayerId,
    relatedPlayerId: playerId,
    minute,
    numericValue: 1,
  })
  ```
- Broadcast via SSE to `games/:gameId`:
  ```ts
  transmit.broadcast(`games/${game.id}`, {
    type: 'stat_accredited',
    statId: stat.id,
  })
  ```
- Fire `GameUpdated` event with reason `'stats'`

### 3. Routes

Add to `start/routes.ts` under `teamOwner` middleware:

```ts
router.group(() => {
  router.post('/games/:gameId/score', [controllers.GameScore, 'update'])
  router.patch('/games/:gameId/stats/:statId/accredit', [controllers.GameStats, 'accredit'])
}).middleware([middleware.auth(), middleware.teamOwner()])
```

### 4. Stat Transformer Update

Update `StatTransformer.toObject()` to expose whether a goal is accredited:

```ts
isFavourited: !this.resource.playerId  // true = unaccredited placeholder
```

Add `isUnaccredited` boolean field:
```ts
isUnaccredited: this.resource.playerId === null,
```

---

## Frontend Changes

### 1. Live Game Screen

Update `screens/LiveGameScreen.tsx` with the following state:

```ts
const [pendingTeam, setPendingTeam] = useState<'home' | 'away' | null>(null)
const [scorerId, setScorerId] = useState<number | null>(null)
const [assistId, setAssistId] = useState<number | null>(null)
const [isOwnGoal, setIsOwnGoal] = useState(false)
const [minute, setMinute] = useState(0)
const liveMinute = useLiveMinute(game)
```

**Score controls behavior:**
- Tapping `+` on either team:
  1. Calls `POST /games/:gameId/score` with `action: 'increment'`
  2. Sets `pendingTeam` to that team
  3. Sets `minute` to current `liveMinute`
  4. Resets `scorerId`, `assistId`, `isOwnGoal`
  5. Accredit section becomes active (no longer dimmed)
- Tapping `−` on either team:
  1. Calls `POST /games/:gameId/score` with `action: 'decrement'`
  2. If `pendingTeam === team`, calls `resetAccredit()`

**`resetAccredit` function:**
```ts
const resetAccredit = () => {
  setPendingTeam(null)
  setScorerId(null)
  setAssistId(null)
  setIsOwnGoal(false)
}
```

### 2. Player Section List

Use `SectionList` (not `FlatList`) to display both teams grouped:

```ts
const playerSections = [
  {
    title: game.homeTeam.name,
    teamId: game.homeTeamId,
    data: game.homeTeam.players,
  },
  {
    title: game.awayTeam.name,
    teamId: game.awayTeamId,
    data: game.awayTeam.players,
  },
]
```

**Scorer list rules:**
- Always visible on screen — not in a modal
- Dimmed/greyed with `pointerEvents="none"` when `pendingTeam` is null
- Activates immediately when `pendingTeam` is set
- Each player row shows: jersey number + name + checkmark when selected
- Tapping a selected scorer deselects them

**Assist list rules:**
- Only renders after `scorerId` is selected AND `isOwnGoal` is false
- Excludes the selected scorer from the list: `data: s.data.filter((p) => p.id !== scorerId)`
- Tapping selected assist player deselects them (assist is optional)

### 3. Accredit Section Visual States

| State | Behavior |
|---|---|
| No `pendingTeam` | Section is dimmed, `pointerEvents="none"` |
| `pendingTeam` set | Section activates, scorer list highlighted |
| `scorerId` selected | Assist list appears below scorer list |
| `isOwnGoal` true | Assist list hidden |
| "Log Goal" tapped | Calls accredit API, then `resetAccredit()` |
| "Skip" tapped | Calls skip endpoint, then `resetAccredit()` |

### 4. Action Buttons

**"Log Goal" button:**
- Disabled when `scorerId` is null or `pendingTeam` is null
- On press → calls `PATCH /games/:gameId/stats/:statId/accredit` with:
  ```ts
  {
    playerId: scorerId,
    assistPlayerId: assistId ?? null,
    isOwnGoal,
    minute,
  }
  ```
- After success → calls `resetAccredit()`

**"Skip — Score Only" button:**
- Disabled when `pendingTeam` is null
- On press → calls `resetAccredit()` only (placeholder already created on increment)

### 5. Own Goal Behavior

- Toggle button: "Own Goal: Yes / No"
- When `isOwnGoal` is true:
  - Assist list is hidden
  - Scorer can be from **either team** — do not filter by `pendingTeam`
  - `statTypeId` switches to `OWN_GOAL_STAT_TYPE_ID` on submit

### 6. Minute Field

- Pre-filled with `liveMinute` when `+` is tapped
- Editable `TextInput` with `keyboardType="numeric"`
- Disabled when `pendingTeam` is null

### 7. Goals Tab

Add a **Goals tab** to the live game screen tabs `[Score] [Goals] [Stats] [Lineup]`:

- Fetches all goal stats for the game
- Displays them in a two-column layout: home goals on left, away goals on right, minute in center
- Unaccredited goals show `"Unaccredited"` as player name with an **"Accredit"** button
- Tapping "Accredit" scrolls back to the Score tab and sets `pendingTeam` to that goal's team — so admin can select the player inline
- Accredited goals show: player name + assist name below if applicable

### 8. SSE Updates

Update the existing `useGameSSE` hook to handle new event types:

```ts
case 'score_updated':
  // update local game homeScore / awayScore
  break

case 'stat_accredited':
  // refetch game stats
  queryClient.invalidateQueries(['game-stats', game.id])
  break
```

---

## What NOT to Do

- Do not open a modal for accrediting — everything is on the same screen
- Do not navigate to another screen to accredit a goal
- Do not hide the player list until after `+` is tapped — it should always be visible but dimmed
- Do not filter the scorer list to only the scoring team — show both teams so admin can pick own goals without extra clicks
- Do not forget `scrollEnabled={false}` on `SectionList` components since they live inside a scrollable screen
- Do not skip the unaccredited placeholder on increment — it keeps score and stats in sync
- Do not allow decrement to go below 0
- Do not forget to fire `GameUpdated` event after score changes so standings update
