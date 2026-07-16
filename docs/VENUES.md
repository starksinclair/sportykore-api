# Venues & map picker (frontend)

League-scoped venues for grassroots football. Admins create reusable pitches for a league, attach them to games, and open directions from lat/lng when available.

API routes live under `apiAuth` + `leagueOwner`. Full table: [ROUTES.md](../ROUTES.md).

## Why three entry paths

Many African community pitches, school fields, and estate grounds are **not** on Google Maps. If the only UI is Places Autocomplete, admins hit dead ends. Treat all three as first-class:

| Path | When | What you get |
| --- | --- | --- |
| **1. Places Autocomplete** | Known stadiums / listed grounds | `name`, `address`, `lat`/`lng`, `googlePlaceId` |
| **2. Drop a pin** | Unlisted pitch with a real location | Admin-typed `name` + `lat`/`lng` (+ optional reverse-geocoded `address`/`city`) |
| **3. Name only** | No map / unknown coords | `name` only — valid; no directions link |

## Schema (client mental model)

```
venues (per league)
  id, leagueId, name
  address?, latitude?, longitude?, googlePlaceId?
  capacity?, city?, notes?
  createdBy, createdAt, updatedAt

games
  venueId?     → venues (ON DELETE SET NULL)
  venueName?   → snapshot / one-off / legacy string
```

- Venues are **league-scoped**, not global. The same real-world pitch may exist as separate rows in many leagues (MVP tradeoff).
- `googlePlaceId` is nullable and **not** unique yet — useful later if you consolidate shared venues.
- Keep sending / reading `venueName` on games. When `venueId` is set, the API copies `venues.name` into `venueName` as a snapshot. If an admin deletes a venue, games keep `venueName` and lose only the structured link.

**Display name:** prefer `game.venue.name` when nested `venue` is present; else `game.venueName`.

## API

### List / create (owner)

```
GET  /api/v1/leagues/:leagueId/venues   → { data: Venue[] }
POST /api/v1/leagues/:leagueId/venues   → 201 { message }
```

### Update / delete (owner)

```
PUT    /api/v1/leagues/venues/:id   → { message }
DELETE /api/v1/leagues/venues/:id   → { message }
```

Ownership for PUT/DELETE is resolved from the venue’s `leagueId` (same middleware as games).

### Venue payload (create / update)

| Field | Create | Update | Notes |
| --- | --- | --- | --- |
| `name` | required, 1–255 | optional | |
| `address` | optional, max 500, nullable | same | Formatted address from Places or reverse geocode |
| `latitude` | optional, −90…90, nullable | same | |
| `longitude` | optional, −180…180, nullable | same | |
| `googlePlaceId` | optional, max 255, nullable | same | From Place Details |
| `capacity` | optional integer 0–999999, nullable | same | |
| `city` | optional, max 120, nullable | same | |
| `notes` | optional, nullable | same | e.g. “Astro turf”, “gate on Adeola St” |

List/transformer shape includes those fields (`latitude`/`longitude` as numbers or `null`).

### Attach to a game

```
POST /api/v1/leagues/games
PUT  /api/v1/leagues/games/:id
```

| Field | Rules |
| --- | --- |
| `venueId` | optional FK to `venues`, nullable — must belong to the game’s league |
| `venueName` | optional string, max 255, nullable — one-off / legacy |

**If both are sent, `venueId` wins** and the server sets `venueName` to the venue’s name.  
**If only `venueName`:** leave `venueId` null.  
**If `venueId: null` on update:** clears the FK; does not wipe `venueName` unless you also send `venueName: null`.

### Nested venue on game detail

`GET /api/v1/games/:id` (and other serializers that preload `venue`):

```json
{
  "venueName": "Teslim Balogun Stadium",
  "venue": {
    "id": 3,
    "name": "Teslim Balogun Stadium",
    "address": "Surelere, Lagos",
    "latitude": 6.4969,
    "longitude": 3.3641,
    "capacity": 24000
  }
}
```

`venue` is omitted/null when there is no `venueId` (or it was deleted). Directions need both coordinates:

```ts
function directionsUrl(lat: number, lng: number) {
  // iOS / Android geo intent
  const geo = `geo:${lat},${lng}?q=${lat},${lng}`
  // Cross-platform browser / Maps
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  return { geo, maps }
}
```

Hide the directions CTA when `latitude` or `longitude` is null (name-only venues).

---

## Expo UI guidance

### Manage hub — Venues section

Add a **Venues** area next to teams (owner-only):

1. `GET .../venues` → list name, city, optional “has map pin” affordance.
2. Add / edit form with the three location paths below + capacity / notes.
3. Delete: confirm; past games keep `venueName`.

### Add / edit game — venue picker

Replace a free-text-only venue field with:

1. **Dropdown** of league venues (`GET .../venues`).
2. **Add new venue** shortcut → same form as manage hub, then select the new id.
3. **One-off name** escape hatch → send `venueName` only (no `venueId`).

### Path 1 — Places Autocomplete

Suggested package: `react-native-google-places-autocomplete`.

1. User types (“Teslim Balogun”).
2. Select a suggestion.
3. Place Details → prefill `name`, `address`, `latitude`, `longitude`, `googlePlaceId`.
4. Admin optionally adds `capacity` / `notes` / `city` → `POST`/`PUT` venue.

**Billing:** use a **session token** for autocomplete + details so search-then-select counts as one Places session. Do not open a new session per keystroke.

Keys stay on the client (Expo config). The Sportykore API does **not** proxy Google Places.

### Path 2 — Drop a pin (first-class)

Suggested package: `react-native-maps` with a **draggable** `Marker` (or long-press to place).

1. Show a map (default to device location or a country/city center).
2. User places / drags the pin → set `latitude` / `longitude`.
3. Optionally reverse-geocode once to prefill `address` / `city` (cheap; skip if you want zero Places cost).
4. **User always types `name`** — reverse geocode must not force a Google place name for an unlisted estate pitch.
5. Leave `googlePlaceId` null unless they also came from Places.

This is how unlisted pitches get real directions without appearing in Autocomplete.

### Path 3 — Name only

Single text field → save venue with `name` only, or game with `venueName` only. Valid. No pin, no directions.

### Recommended form UX

```
[ Search Google Places… ]     ← path 1
        or
[ Drop pin on map ]           ← path 2 (opens map sheet)
        or
[ Name only ]                 ← path 3

Name *        [____________]
Address       [____________]  (from Places / reverse geocode / manual)
City          [____________]
Capacity      [____________]
Notes         [____________]
```

Do not bury drop-pin / name-only behind “advanced”. For many leagues they will be the default.

---

## Cost notes (Places)

| Action | Cost tendency |
| --- | --- |
| Autocomplete + Details with session token | One session per search→select |
| Reverse geocode after drop-pin | Cheap; optional |
| Name-only / pin without geocode | No Places charges |

Lean on paths 2–3 for venues that will never resolve in Autocomplete.

## Out of scope (API)

- Shared global venue directory / moderation
- Server-side Google Places proxy
- Backfilling `venueId` from legacy `venueName` strings
