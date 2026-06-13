# Live Game Time Implementation Prompt

> **Backend (this repo):** Implemented — migration, `GameTimeService`, `GameTimeController`, `teamOwner` middleware, routes under `/api/v1/games/:gameId/*`, transformer fields, SSE `status_changed` broadcasts. See [ROUTES.md](../ROUTES.md).
>
> **Mobile (React Native):** Hooks/components below are for the Expo app — not in this repository.

## Context

We are building a soccer league management platform using AdonisJS (backend) and React Native Expo (frontend). We already have:

| Already Exists             | Detail                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `games` table              | Has `status`, `homeScore`, `awayScore`, `currentMinute` columns  |
| `GameResultUpdated` event  | Fires when game score or status changes                          |
| `UpdateStandings` listener | Recalculates standings and broadcasts via SSE                    |
| Transmit SSE               | Already configured for real-time broadcasting                    |
| `LeagueOwnerMiddleware`    | Guards league-level routes                                       |
| `TeamOwnerMiddleware`      | Guards team-level routes — both league owner and team owner pass |

---

## Task

Implement a **live game time system** where the current match minute is calculated mathematically from stored timestamps — not polled or stored in the DB every minute.

---

## Core Principle

> Never update `currentMinute` in the DB every minute. Instead, store **when each half started** as a timestamp, then calculate the current minute as:
>
> ```
> currentMinute = now - halfStartedAt (in minutes)
> ```
>
> The minute is always accurate because it is computed from real timestamps on the client side.

---

## Database Changes

Add the following columns to the existing `games` migration, i will just rerun the migration:

```ts
// half durations — set when creating the game
table.integer('first_half_duration').defaultTo(45) // in minutes
table.integer('second_half_duration').defaultTo(45) // in minutes
table.integer('extra_time_duration').nullable() // only if applicable

// timestamps set when admin starts each period
table.timestamp('first_half_started_at').nullable()
table.timestamp('second_half_started_at').nullable()
table.timestamp('extra_time_started_at').nullable()
```

Update the existing `status` enum to include all period states:

```ts
table
  .enum('status', [
    'scheduled',
    'first_half',
    'half_time',
    'second_half',
    'extra_time',
    'full_time',
    'cancelled',
    'postponed',
    'paused',
  ])
  .defaultTo('scheduled')
```

---

## Backend Implementation

### 1. GameTimeService

Create `app/services/game_time_service.ts`:

- Method `calculateCurrentMinute(game: Game): number`
- Uses `DateTime` from Luxon for all time calculations
- Logic per status:

| Status        | Minute Calculation                                                    |
| ------------- | --------------------------------------------------------------------- |
| `scheduled`   | `0`                                                                   |
| `first_half`  | `now - firstHalfStartedAt` (in minutes)                               |
| `half_time`   | `firstHalfDuration`                                                   |
| `second_half` | `firstHalfDuration + (now - secondHalfStartedAt)`                     |
| `extra_time`  | `firstHalfDuration + secondHalfDuration + (now - extraTimeStartedAt)` |
| `full_time`   | `firstHalfDuration + secondHalfDuration`                              |

### 2. GameTimeController

Create `app/controllers/game_time_controller.ts` with these actions:

| Action            | Method                                  | What it does                                                                     |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `startFirstHalf`  | `POST /games/:gameId/start-first-half`  | Sets `status = 'first_half'`, `firstHalfStartedAt = now`                         |
| `startHalfTime`   | `POST /games/:gameId/half-time`         | Sets `status = 'half_time'`                                                      |
| `startSecondHalf` | `POST /games/:gameId/start-second-half` | Sets `status = 'second_half'`, `secondHalfStartedAt = now`                       |
| `startExtraTime`  | `POST /games/:gameId/extra-time`        | Sets `status = 'extra_time'`, `extraTimeStartedAt = now`                         |
| `pause`           | `POST /games/:gameId/pause`             | Sets `status = 'paused'`, stores `pausedAt` and `pausedFromStatus`               |
| `resume`          | `POST /games/:gameId/resume`            | Restores prior period; shifts period start timestamp by pause duration           |
| `endGame`         | `POST /games/:gameId/full-time`         | Sets `status = 'full_time'`, saves `homeScore` and `awayScore` from request body |

After every status change, broadcast via Transmit SSE to the `games/:gameId` channel:

```ts
transmit.broadcast(`games/${game.id}`, {
  type: 'status_changed',
  status: game.status,
  firstHalfStartedAt: game.firstHalfStartedAt,
  secondHalfStartedAt: game.secondHalfStartedAt,
  extraTimeStartedAt: game.extraTimeStartedAt,
  homeScore: game.homeScore,
  awayScore: game.awayScore,
})
```

The `endGame` action must also fire the existing `GameUpdated` event with reason `'result'` so standings recalculate automatically.

### 3. Routes

Add to `start/routes.ts` under `teamOwner` middleware (both league owner and team owner can control game time):

```ts
router
  .group(() => {
    router.post('/games/:gameId/start-first-half', [controllers.GameTime, 'startFirstHalf'])
    router.post('/games/:gameId/half-time', [controllers.GameTime, 'startHalfTime'])
    router.post('/games/:gameId/start-second-half', [controllers.GameTime, 'startSecondHalf'])
    router.post('/games/:gameId/extra-time', [controllers.GameTime, 'startExtraTime'])
    router.post('/games/:gameId/full-time', [controllers.GameTime, 'endGame'])
  })
  .middleware([middleware.auth(), middleware.teamOwner()])
```

### 4. Game Transformer

Update `GameTransformer.toObject()` to include the new timestamp fields so the frontend can calculate the live minute:

```ts
this.pick(this.resource, [
  'id',
  'status',
  'homeScore',
  'awayScore',
  'firstHalfDuration',
  'secondHalfDuration',
  'extraTimeDuration',
  'firstHalfStartedAt',
  'secondHalfStartedAt',
  'extraTimeStartedAt',
  'playedAt',
  'venueName',
  'currentMinute',
])
```

---

## Frontend Implementation -- this is for the mobile app

### 1. `useLiveMinute` Hook

Create `hooks/useLiveMinute.ts`:

- Accepts a `game` object
- Uses `setInterval` with a **1 second** tick
- Calculates the current minute from the game's timestamps locally — no API polling
- Returns the current `minute` as a number
- Clears interval on unmount
- Stops updating when status is `scheduled`, `half_time`, `full_time`, `cancelled`, or `postponed`

Minute logic to implement:

```ts
if (status === 'first_half' && firstHalfStartedAt) {
  minute = differenceInMinutes(now, new Date(firstHalfStartedAt))
}

if (status === 'second_half' && secondHalfStartedAt) {
  minute = firstHalfDuration + differenceInMinutes(now, new Date(secondHalfStartedAt))
}

if (status === 'extra_time' && extraTimeStartedAt) {
  minute =
    firstHalfDuration + secondHalfDuration + differenceInMinutes(now, new Date(extraTimeStartedAt))
}
```

### 2. SSE Subscription Hook

Create `hooks/useGameSSE.ts`:

- Subscribes to `games/:gameId` Transmit channel
- On `status_changed` message → updates local game state with new status and timestamps
- Triggers `useLiveMinute` to recalculate from new timestamps automatically
- Unsubscribes on unmount

### 3. Live Minute Display Component

Create `components/LiveMinute.tsx`:

- Takes `game` as prop
- Calls `useLiveMinute(game)`
- Displays:
  - `HT` when status is `half_time`
  - `FT` when status is `full_time`
  - `45+N'` when first half minute exceeds `firstHalfDuration`
  - `90+N'` when second half minute exceeds `firstHalfDuration + secondHalfDuration`
  - `N'` otherwise
- Shows a red pulsing dot indicator when game is live (`first_half`, `second_half`, `extra_time`)

### 4. Admin Game Controls Component

Create `components/GameControls.tsx` (only visible to league owner or team owner):

- Shows contextual buttons based on current game status:

| Current Status | Button shown               |
| -------------- | -------------------------- |
| `scheduled`    | "Start First Half"         |
| `first_half`   | "Half Time"                |
| `half_time`    | "Start Second Half"        |
| `second_half`  | "Full Time" / "Extra Time" |
| `extra_time`   | "Full Time"                |
| `full_time`    | No buttons                 |
| `paused`       | "Resume"                   |

- "Full Time" button opens a modal to enter final `homeScore` and `awayScore` before confirming
- Each button calls the corresponding API endpoint
- Disable buttons while request is in flight

---

## Full Flow

```
Admin creates game with firstHalfDuration=45, secondHalfDuration=45
        ↓
Match day → admin taps "Start First Half"
        ↓
API sets firstHalfStartedAt = now, status = 'first_half'
        ↓
SSE broadcasts status_changed to all subscribers
        ↓
Frontend receives update → useLiveMinute starts local timer
        ↓
Displays 1'... 2'... 3'... with no server polling
        ↓
Admin taps "Half Time" → status = 'half_time'
        ↓
SSE broadcasts → timer freezes at firstHalfDuration (45')
        ↓
Admin taps "Start Second Half" → secondHalfStartedAt = now
        ↓
SSE broadcasts → timer resumes from firstHalfDuration + 1 (46')
        ↓
Admin taps "Full Time" → enters final score
        ↓
API saves score → fires GameUpdated event
        ↓
Standings recalculate → SSE pushes standings update to all viewers
```

---

## What NOT to Do

- Do not update `currentMinute` in the DB every minute
- Do not poll the API for the current minute
- Do not use `setTimeout` chains — use `setInterval` with cleanup
- Do not forget to unsubscribe from SSE on component unmount
- Do not allow non-owners to access game control endpoints
- Do not skip the score entry modal on full time — always confirm before ending the game
