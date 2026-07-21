# Group stages

Group stages (`stage_type = 'group'`) sit between round-robin league tables and knockout brackets. Teams are placed into named groups (A, B, C…), play round-robin fixtures within each group, and then an ordered qualifier list seeds an existing knockout via `generateKnockoutPhase` **without modifying bracket core**.

Expo / mobile UI for groups is out of scope in this repo — see endpoints below and [ROUTES.md](../ROUTES.md).

Related: [KNOCKOUT.md](./KNOCKOUT.md), [MANAGE_LEAGUE.md](./MANAGE_LEAGUE.md).

---

## Model

| Entity | Role |
| --- | --- |
| `stages` (`group`) | Phase config: `format.group_count`, `format.double_round_robin`, `advancement.per_group` |
| `stage_groups` | Named groups A..N with `sequence` |
| `stage_teams` | Team ↔ group assignment (`stage_group_id`, `seed`) |
| `games` | Intra-group fixtures (`stage_id` + `stage_group_id`, no `tie_id` / `round`) |
| `standing_adjustments` | Point deltas (deductions/bonuses) — input to live compute |
| `standing_overrides` | Manual reorder of teams tied on **points + played** (cohort-scoped) |
| `standing_zones` | Presentation bands on positions (e.g. `qualified` 1..N) |
| `admin_audit_logs` | Append-only owner action history |

Knockout created from groups sets `source_stage_id` on the new stage.

---

## Fixed sort (shared with league tables)

Standings sort is **hardcoded** (not `league.tiebreaker`):

1. Points desc  
2. Goal difference desc  
3. Goals for desc  
4. Team name asc  

Scoring is always 3 / 1 / 0. The `leagues.tiebreaker` column remains for legacy clients but is **not** read by standings paths — treat it as legacy.

Pure aggregation lives in `app/services/standings/compute_table.ts` (`computeTable`, `compareTableRows`, `cohortSignature`).

---

## Standings pipeline (`StageStandingService.forStage`)

Applies to **`round_robin` and `group`** only (knockout/playoff → 422).

1. Load games in `STANDING_GAME_STATUSES` scoped by `stage_id` (+ `stage_group_id` for groups).  
2. Sum `standing_adjustments.points_delta` into points.  
3. Fixed sort → assign positions.  
4. Apply cohort overrides whose `cohort_signature` still matches; mark others **stale** (do not delete on read).  
5. Tag rows with zones whose position range contains the row (`stage_group_id` null = all groups).

Response shape:

```ts
{
  stage: Stage
  tables: Array<{
    stageGroupId: number | null
    stageGroupName: string | null
    sequence: number | null
    rows: EnrichedTableRow[]  // + adjustmentReasons, manuallyAdjusted, overrideReason, zone
    staleOverrides: StandingOverride[]
  }>
}
```

Round-robin yields one table with `stageGroupId: null`. Group stages yield one table per `stage_groups` row in `sequence` order.

---

## Lifecycle

```
createGroupStage → assignTeams (manual | snake auto) → generateGroupFixtures
  → play games → GET standings → GET qualifiers?dryRun=true → POST generate-knockout
```

### Create

- `POST /leagues` with `format: "group"` + optional `group: { name?, config? }`  
- Defaults if config omitted: `group_count: 2`, `double_round_robin: false`, `per_group: 2`  
- Creates stage + groups A..N + one `qualified` zone `1..per_group` (`stage_group_id` null)  
- **Does not** assign teams or generate fixtures (`seeded: false`)

### Assign

- **Manual:** `{ mode: "manual", assignments: [{ teamId, stageGroupId }] }`  
- **Auto:** `{ mode: "auto", teamIds, shuffle? }` — snake draw across groups (uneven sizes OK)  
- Refuses if `stage_teams` already exist (409)

### Fixtures

Circle-method round robin per group; doubles if `double_round_robin`. Games get `played_at` staggered by matchday. Idempotent refuse if any game exists for the stage (409). Sets stage `active`.

---

## Qualifiers → knockout

`QualifierService.resolveQualifiers`:

- **Tier 1:** positions `1..per_group` from each group (automatic).  
- **Tier 2 (thirds):** only if `targetRound` needs more than automatic count; `thirdsMode: auto|manual`. Never promote beyond one tier.  
- Default without `targetRound`: automatic qualifiers only; bracket pads with byes (`nextPow2`).  
- Seeding order: winners (ranked among themselves) → runners-up → thirds.  
- `proposedPairings` is advisory.

`POST …/generate-knockout`:

1. Guard incomplete games unless `force`  
2. Use client `qualifiers[]` if provided (organizer wins)  
3. Create knockout with `source_stage_id`, set `config.format.starting_round` from `targetRound`  
4. Call existing `BracketService.generateKnockoutPhase` unchanged  
5. Mark group stage `completed`

Preview: `GET …/qualifiers?dryRun=true` (no writes; incomplete games allowed).

---

## Adjustments / overrides / zones

| Feature | Rules |
| --- | --- |
| Adjustments | Non-zero delta −50..50; required `reason`; multiple rows sum. For `round_robin` stages, also immediately re-synced into the legacy `standings` table read by `GET /leagues/:leagueId` and `GET /teams/:id` — see [ROUTES.md](../ROUTES.md) — so a deduction shows up there without waiting for the next game score update. |
| Overrides | Full tied cohort on (points, played); contiguous ranks 1..N; store `cohort_signature` |
| Zones | Position ranges; auto-seeded `qualified` on group create only |

---

## Endpoints (API v1)

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/leagues` (`format: group`) | auth |
| POST | `/leagues/:leagueId/stages` (`stageType: group`) | owner |
| POST | `/leagues/stages/:id/groups/assign` | owner |
| POST | `/leagues/stages/:id/fixtures` | owner |
| GET | `/leagues/stages/:id/standings` | public |
| GET/POST | `/leagues/stages/:id/standings/adjustments` | owner |
| PUT/DELETE | `/leagues/stages/adjustments/:aid` | owner |
| POST | `/leagues/stages/:id/standings/overrides` | owner |
| DELETE | `/leagues/stages/:id/standings/overrides/:oid` | owner |
| GET/POST | `/leagues/stages/:id/zones` | owner |
| PUT/DELETE | `/leagues/stages/zones/:zid` | owner |
| GET | `/leagues/stages/:id/qualifiers?dryRun=true` | owner |
| POST | `/leagues/stages/:id/generate-knockout` | owner |
| GET | `/leagues/:leagueId/audit-logs` | owner |

Full request/response notes: [ROUTES.md](../ROUTES.md).
