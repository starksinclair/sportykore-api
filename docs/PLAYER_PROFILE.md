# Player profile v2

Extends `players` with richer fields, YouTube highlights, and a two-state
"has-profile / no-profile" resolution endpoint that drives the app's profile
CTA. See [ROUTES.md](../ROUTES.md) for the full endpoint/payload reference.

---

## Model

`players` gained (all nullable unless noted):

| Column | Notes |
| --- | --- |
| `primary_position`, `secondary_position` | Reuse the roster position enum (`goalkeeper`, `defence`, `midfield`, `attack`) |
| `preferred_foot` | `left` \| `right` \| `both` |
| `height_cm` | 100–250 |
| `date_of_birth` | **Stored, never serialized** — see below |
| `city`, `state`, `nationality` | Free text |
| `social_handle` | One field: Instagram or TikTok handle |
| `visibility` | `active` \| `private`, **not null**, default `active` — see below |

Deliberately **not** added: jersey number (belongs to team membership — the
same player wears different numbers at different clubs, see `league_players`)
and any "looking for a team" flag (marketplace feature, out of scope).

`player_highlights` (new table):

| Column | Notes |
| --- | --- |
| `player_id` | FK `players`, `ON DELETE CASCADE` |
| `video_id` | The YouTube video ID only (11 chars), never a full URL |
| `title` | Optional, max 140 chars |
| `sort_order` | Rewritten wholesale on reorder |

Unique on `(player_id, video_id)` — no duplicate clips on one profile. Capped
at 10 highlights per player (`MAX_HIGHLIGHTS_PER_PLAYER` in `#types/player`).

---

## Date of birth — store, never expose

Collected at profile creation (`createPlayerProfileValidator`), validated to
imply an age between 5 and 70 and not be in the future
(`PlayerProfileService.assertPlausibleDateOfBirth`). **The transformer never
serializes `date_of_birth`** — `PlayerTransformer.profile()` computes and
returns `age` only. This is enforced in `PlayerTransformer`, not the client,
so it can't leak through a different endpoint later.

Rationale: age is what users want to see; DOB is what's painful to backfill
later and what future consent/eligibility work depends on. Collect once,
expose narrowly.

---

## `visibility` — dormant hook

Defaults to `active`. Nothing in this build sets a player to `private` — no
UI toggle exists yet. This is the hook a later guardian-consent flow will
flip; no consent logic ships here.

The blanking behavior is implemented and tested now so it's ready:

**`PlayerTransformer` is the single serialization path for players.** When
`visibility = 'private'`, every variant (`toObject`, `withStats`,
`withCountry`, `profile`) collapses to a minimal stub:

```json
{ "id": 42, "name": "Private Player", "visibility": "private" }
```

No photo, bio, position, location, social handle, highlights, or stats leak
through. Because every other transformer that serializes a player
(`LeaguePlayerTransformer`, `GameLineupTransformer`, `StatTransformer`,
`TeamSeasonDetailTransformer`) calls `PlayerTransformer.transform(...)`
rather than reimplementing player serialization, the stub rule holds
everywhere a player appears: team rosters, match lineups, stat/leaderboard
rows, search results, and league member lists. Non-transformer surfaces
(`CountryService` featured-players leaderboard, `SearchService` raw SQL) each
carry their own `visibility === 'private'` check for the same effect.

See `tests/unit/player_private_stub_surfaces.spec.ts` for the surface-by-surface
assertions.

---

## Highlights — YouTube URL parsing

`#helpers/youtube.ts` (`parseYouTubeVideoId`) accepts a pasted URL and
extracts the video ID server-side — the client never sends a raw video ID.
Supported forms, with or without `www.`, scheme, and extra query params:

- `youtube.com/watch?v=ID`
- `youtu.be/ID`
- `youtube.com/shorts/ID`
- `youtube.com/embed/ID`, `youtube.com/live/ID`

The extracted ID is validated against `^[A-Za-z0-9_-]{11}$`; anything else
(non-YouTube host, missing ID) is rejected with a 422. **No YouTube Data API
call is made** — no key, no quota. Storing the ID (not the URL) gives free
thumbnails at `https://img.youtube.com/vi/{video_id}/hqdefault.jpg`
(`youTubeThumbnailUrl`) and clean rendering with `react-native-youtube-iframe`
client-side. A private/deleted video fails gracefully in the embed; that's
acceptable — this repo does not validate video existence.

Rules enforced in `PlayerHighlightService`:

- Cap at 10 highlights per player; the 11th is rejected with a clear message.
- Duplicate `video_id` on the same player is rejected (409).
- **Only the profile owner** may add, reorder, edit, or delete their own
  highlights — every method resolves the player from the authenticated
  user's own `players` row (`PlayerProfileService.findOwnOrFail`), not
  `leagueOwner`. League owners and team admins have no access — this is
  personal media.
- Reorder takes a full ordered array of highlight IDs and rewrites
  `sort_order` from that order; a partial or mismatched array is rejected.

---

## Profile resolution — the two-state CTA

`GET /api/v1/me/player` is the single call the app's profile tab needs to
decide between "Create player profile" and "View profile":

- **200** `{ data: { player, completeness, missingFields, highlightsCount, membership } }`
  if the authenticated user has a player profile.
- **404** `{ message }` if they do not — this *is* the "no profile" signal,
  not an error to special-case.

`membership.inLeague` / `membership.inTeam` reflect whether the player has
any **active** `league_players` row, so the app can show a "join a league"
entry point when they don't.

### Completeness

Computed server-side (`PlayerProfileService.completenessFor`) so the rule
lives in one place — a weighted checklist over photo (20), bio (10), primary
position (15), preferred foot (10), date of birth (15), city (10), and at
least one highlight (20), summing to 100. Returns the percentage plus
`missingFields` (the checklist keys not yet filled) so the client can render
a nudge without duplicating the logic.

---

## Out of scope (deferred)

- Guardian/parental consent, age gating, school-processor flows. Only the
  `visibility` field and its blanking behavior ship now.
- YouTube Data API integration (titles, durations, existence checks).
- Video hosting of any kind — links only.
