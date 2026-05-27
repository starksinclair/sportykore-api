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
| `gameDate` | No | Calendar date `YYYY-MM-DD`. Defaults to **today** in `timeZone`. |
| `timeZone` | Recommended | IANA timezone (e.g. `Africa/Lagos`). Defaults to `UTC` if omitted. |
| `gameStatus` | No | Filter games by status (`live`, `completed`, etc.). |
| `countryId` | No | Limit to one country. |

Invalid `timeZone` or `gameDate` → `400`.

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
    headers: { Accept: 'application/json' },
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

- Do **not** send only `gameDate` and assume the server uses the user’s local day without `timeZone` (server defaults to `UTC`).
- Do **not** use `date.toISOString().slice(0, 10)` for the picker day near midnight — that can shift the calendar day. Use local `getFullYear()` / `getMonth()` / `getDate()` (your helper already does this).
- Do **not** store local times in the DB from the client; send UTC ISO for create/update of `playedAt` when you add those forms.

## Backend reference

- `LeagueService.resolveMatchDayWindow(gameDate?, timeZone?)` — public for tests; returns UTC SQL bounds.
- `LeagueService.listLeagueByCountry(..., timeZone, ...)` — matches index.
- Implementation: `app/services/league_service.ts`

## Related

- [ROUTES.md](../ROUTES.md) — full API table
- [MOBILE_AUTH_ROUTES.md](../MOBILE_AUTH_ROUTES.md) — auth only
