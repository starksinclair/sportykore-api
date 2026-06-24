# Time and timezone conventions

Sportykore stores **all instants in UTC** in the database (`played_at`, timestamps, etc.).  
Clients **display** times in the user’s local timezone.  
When filtering **“games on a calendar day”**, the API uses the user’s **IANA timezone**, not a UTC calendar day.

## Model

| Concern | Rule |
| --- | --- |
| **Storage** | UTC (`timestamptz` / ISO strings with `Z`) |
| **API responses** | ISO 8601 UTC (e.g. `2026-05-23T17:30:00.000Z`) |
| **UI display** | `new Date(iso)` + `toLocaleString()` or `Intl.DateTimeFormat` |
| **“Games on May 23” filter** | `gameDate` = calendar date the user picked; `timeZone` = their IANA zone |

### Example (Lagos, `Africa/Lagos`, UTC+1)

User selects **23 May 2026** on the calendar.

| Step | Value |
| --- | --- |
| Client sends | `gameDate=2026-05-23`, `timeZone=Africa/Lagos` |
| Local day | 23 May 2026 00:00 → 23:59:59.999 in Lagos |
| UTC window (DB filter) | `2026-05-22T23:00:00` → `2026-05-23T22:59:59.999` |
| Game at `2026-05-23T20:00:00Z` | Included (8pm UTC = 9pm Lagos, still 23 May locally) |

## API: `GET /api/v1/leagues` (matches feed)

Documented in [ROUTES.md](../ROUTES.md). Relevant query parameters:

| Param | Required | Description |
| --- | --- | --- |
| `gameDate` | No | Calendar date `YYYY-MM-DD`. Defaults to **today** in the resolved `timeZone`. |
| `timeZone` | Recommended | IANA timezone (e.g. `Africa/Lagos`). Query param, or `Time-Zone` / `X-Timezone` request header. Defaults to `UTC` if omitted everywhere. |
| `gameStatus` | No | Filter games by status (`live`, `completed`, etc.). |
| `countryId` | No | Limit to one country. |

Invalid `timeZone` or `gameDate` → `400`.

The response includes `matchDay: { gameDate, timeZone }` so clients can confirm which local calendar day was used for `matches`.

Only countries/leagues with at least one game in the UTC window are returned.

## Frontend implementation

### 1. Helpers (recommended)

```typescript
/** Calendar date for API query params (local Y-M-D, not a UTC instant). */
export function toCalendarDateParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** User's IANA timezone for match-day filtering. */
export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** Display a UTC instant from the API in the user's locale. */
export function formatPlayedAt(playedAtIso: string): string {
  return new Date(playedAtIso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
```

Rename your existing `toUtcIsoDate` to `toCalendarDateParam` if you like — it already sends the **local calendar date**, which is what Option 2 expects. You do **not** need to convert that string to UTC on the client; send `timeZone` instead.

### 2. Fetching the leagues index (matches)

```typescript
type LeaguesIndexParams = {
  countryId?: number
  gameStatus?: string
  gameDate?: Date // omit = today in user's timezone
}

export async function fetchLeaguesIndex(params: LeaguesIndexParams = {}) {
  const gameDate = toCalendarDateParam(params.gameDate ?? new Date())
  const timeZone = getUserTimeZone()

  const search = new URLSearchParams({
    gameDate,
    timeZone,
  })

  if (params.countryId) search.set('countryId', String(params.countryId))
  if (params.gameStatus) search.set('gameStatus', params.gameStatus)

  const res = await fetch(`/api/v1/leagues?${search}`, {
    headers: {
      Accept: 'application/json',
      'Time-Zone': timeZone,
    },
  })

  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ data: { leagues: unknown; matches: unknown } }>
}
```

### 3. React example (date picker)

```tsx
const [selectedDate, setSelectedDate] = useState(() => new Date())

useEffect(() => {
  fetchLeaguesIndex({
    gameDate: selectedDate,
    gameStatus: 'live', // optional
  }).then((payload) => {
    // payload.data.matches — countries with leagues/games that day (user's TZ)
  })
}, [selectedDate])
```

### 4. React Native

`Intl.DateTimeFormat().resolvedOptions().timeZone` works on current RN with Hermes. If unavailable, pass a stored user preference or default (e.g. `Africa/Lagos`).

### 5. What not to do

- Do **not** send only `gameDate` without a timezone — set `timeZone` on the query string **or** send a `Time-Zone` / `X-Timezone` header on every request (e.g. from `getUserTimeZone()`). If both are omitted, the server defaults to `UTC`, which is wrong for most users.
- Do **not** filter match-day results on the client using `new Date(playedAt)` alone — use `gameDate` + timezone (query or header) and read `data.matchDay` from the response to confirm the filter.
- Do **not** use `date.toISOString().slice(0, 10)` for the picker day near midnight — that can shift the calendar day. Use local `getFullYear()` / `getMonth()` / `getDate()` (your helper already does this).
- Do **not** store local times in the DB from the client; send UTC ISO for create/update of `playedAt` when you add those forms.

## Backend reference

- `resolveRequestTimeZone(query, request)` — `app/helpers/time_zone.ts`; query param, then `Time-Zone` / `X-Timezone` headers.
- `LeagueService.resolveMatchDayContext(gameDate?, timeZone?)` — resolved `gameDate`, `timeZone`, and UTC SQL bounds.
- `LeagueService.resolveMatchDayWindow(gameDate?, timeZone?)` — UTC bounds only (tests).
- `LeagueService.listLeagueByCountry(..., timeZone, ...)` — matches index.
- `GET /api/v1/leagues` returns `matchDay: { gameDate, timeZone }` alongside `matches`.
- Implementation: `app/services/league_service.ts`, `app/controllers/leagues_controller.ts`

## Related

- [ROUTES.md](../ROUTES.md) — full API table
- [MOBILE_AUTH_ROUTES.md](../MOBILE_AUTH_ROUTES.md) — auth only
