# Reviewer access (App Store / Play Store)

Store reviewers cannot receive OTP emails. This document covers the env-gated
OTP bypass and the demo dataset those accounts land in.

Expo / mobile UI changes are out of scope — response shapes are unchanged.

---

## Accounts

| Role | Env var | Purpose |
| --- | --- | --- |
| League admin | `REVIEW_ADMIN_EMAIL` | Owns both demo competitions; manage hub, venues, stages |
| Player | `REVIEW_PLAYER_EMAIL` | Rostered on **Riverside Athletic** in both competitions; full profile |

Suggested values (set in the deployment env, do **not** hardcode in source):

```
REVIEW_ACCOUNT_ENABLED=true
REVIEW_ADMIN_EMAIL=review-admin@sportykore.com
REVIEW_PLAYER_EMAIL=review-player@sportykore.com
REVIEW_OTP_CODE=424242
```

`REVIEW_OTP_CODE` must be exactly **6 digits**. The bypass is inactive unless
`REVIEW_ACCOUNT_ENABLED=true` **and** both emails and the code are set.

---

## OTP bypass behaviour

Implemented in [`app/services/review_account.ts`](../app/services/review_account.ts)
and [`app/services/otp_service.ts`](../app/services/otp_service.ts).

- **Request OTP** (`POST /api/v1/auth/request-otp`): if the email **exactly**
  equals a configured reviewer email → same `{ message: "OTP sent" }` success,
  **no email** is sent and no `otp_codes` row is created.
- **Verify OTP** (`POST /api/v1/auth/verify-otp`): if email matches **and** the
  submitted code equals `REVIEW_OTP_CODE` → Bearer token issued like a normal
  verify. Wrong code → normal 401 path. Non-reviewer emails cannot use
  `REVIEW_OTP_CODE`.
- Matching is **strict equality only** (no domain wildcards).
- Bypass uses are logged via the structured logger
  (`review_account_otp_request_bypass` / `review_account_otp_verify_bypass`).
- OTP rate limits were raised globally (15 / 10 minutes) so reviewers are less
  likely to lock themselves out; there is **no** per-email allowlist in the
  limiter.

### Disable after launch

Set `REVIEW_ACCOUNT_ENABLED=false` (or unset it) and redeploy / restart. No code
change required. Reviewer emails then behave like any other user.

---

## DemoSeeder

Creates a fully populated app state for those two accounts.

**Container start** (wired in `Dockerfile` and `docker-compose.*.yml` after migrations):

```bash
node ace db:seed --files=database/seeders/demo_seeder.ts
```

Production images set `ALLOW_DEMO_SEED=true` for that step because `NODE_ENV=production`.

**Manual / one-off:**

```bash
# Non-production
node ace db:seed --files="database/seeders/demo_seeder.ts"

# Production
ALLOW_DEMO_SEED=true node ace db:seed --files="database/seeders/demo_seeder.ts"
```

Requires `REVIEW_ADMIN_EMAIL` and `REVIEW_PLAYER_EMAIL` so seeded users match
the bypass. Idempotent: re-running upserts users/leagues/teams and **skips**
fixture regeneration when games already exist.

### What it creates

1. **Sportykore Demo League** (round-robin)
   - Active season, 8 teams, 10–12 players each
   - ~65% of fixtures completed with goals/assists/cards; rest scheduled
   - Populated league table (computed via standings services — not hand-written)
   - 2 venues; most games have a venue attached
   - Lineups on several completed matches

2. **Sportykore Demo Cup** (groups → knockout)
   - 2×4 groups, all group games completed (qualification zones present)
   - Knockout with `source_stage_id` set; SF completed (one on **penalties**);
     Final left pending

3. **Shared career**
   - Reviewer player is on **Riverside Athletic** in both competitions
   - Full profile (bio, positions, foot, height, DOB, city/state/nationality)
   - 2 YouTube highlight video IDs
   - Admin also has a basic player profile
   - Both users favourite both leagues

Goals are written atomically with score updates (same invariant as
`GameScoreService`: score column + goal stat together). Seed path avoids
Transmit broadcasts so local/SQLite runs do not stall on Redis.

### Safety

- Blocked when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`
- League names are namespaced (`Sportykore Demo …`) for easy discovery/removal

---

## Manual store listing (not automated)

Put the two emails, the fixed OTP, and a short walkthrough into:

- Play Console → **App content** → **App access** / sign-in details
- App Store Connect → **App Review Information**

Suggested walkthrough (plain text):

1. Sign in with `REVIEW_PLAYER_EMAIL` (or admin) and enter `REVIEW_OTP_CODE`.
2. Open favourites / home — select **Sportykore Demo League**.
3. Open the table (standings) — confirm a populated league table.
4. Open a completed match — score, events, venue, lineup.
5. Open **Sportykore Demo Cup** — group tables, then knockout; find the
   penalty shootout result.
6. Open the player profile — career stats and highlights.
