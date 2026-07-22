# Sportykore Product Reference

## Status Legend

- **[LIVE]** - implemented end to end in backend + mobile app and usable by a real user.
- **[BACKEND-ONLY]** - API or backend logic exists, but there is no clear mobile UI flow yet.
- **[SCHEMA-READY]** - database columns/enums/config shape exist, but no runnable user feature. Do not document these as available product features.

## 1. Overview

Sportykore is a mobile-first platform for running grassroots football/soccer competitions. The product lets organizers create competitions, add teams, invite players, schedule fixtures, run match day from a phone, record live scores and events, and publish public league/team/player/match pages.

The current backend is an **AdonisJS 7 JSON API** with a small Inertia web surface. The mobile app is **React Native / Expo**. The prompt's PostgreSQL anchor is only partly true: the backend has a PostgreSQL connection for Docker/compose, but the configured default connection is SQLite (`tmp/db.sqlite3`) unless `DB_CONNECTION` is changed. The app has offline-oriented read caching through persisted TanStack Query data, but writes are not queued offline. `(backend: config/database.ts, start/routes.ts; mobile: app/_layout.tsx, src/lib/query-client.ts)`

### Core Mental Model

A **league** is the top-level competition owned by one organizer. A league has one or more **seasons**. Each season has **teams**, **players/rosters**, **games**, and one or more **stages**. A stage can be a round-robin league table or a knockout bracket. Public viewers can browse the resulting pages; authenticated organizers manage their own competitions; team admins can manage lineups and match day for assigned teams.

### Roles

#### [LIVE] Public Viewer

**What it is**  
A public viewer can browse competitions without signing in: home feed, countries, leagues, matches, teams, players, standings, stats, brackets, venues, and public lineups.

**How the user does it**
1. Complete onboarding in the app.
2. Browse the home feed or search.
3. Open a league, match, team, player, or country page.

**Key rules & constraints**
- Public read routes do not require bearer auth.
- Favouriting, creating, managing, joining, and lineup editing require sign-in.
- Optional bearer auth decorates public league feeds with favourite state when logged in.

**Status tag**  
[LIVE]

**Code references**  
`start/routes.ts`, `app/controllers/leagues_controller.ts`, `app/controllers/games_controller.ts`, `app/controllers/teams_controller.ts`, `app/controllers/players_controller.ts`; mobile: `app/(app)/(tabs)/index.tsx`, `app/(app)/league/[id].tsx`, `app/(app)/match/[id].tsx`, `app/(app)/team/[id].tsx`, `app/(app)/player/[id].tsx`, `app/(app)/country/[id].tsx`.

#### [LIVE] League Organizer / Owner

**What it is**  
The organizer is the authenticated user who owns a league. Owner-only actions include editing league settings, creating seasons, teams, venues, games, stages, stats, score/time updates, invites, and roster changes.

**How the user does it**
1. Sign in with email OTP.
2. Create a league, or open an owned league from the Manage tab.
3. Use Manage tabs: Games, Knockout, Teams, Players, Venues, Settings.

**Key rules & constraints**
- Ownership is enforced by `LeagueOwnerMiddleware`.
- The middleware resolves the league from route params, request body, game, venue, stage, stat, or league-player resource.
- If `league.userId !== auth.user.id`, the API returns 403.

**Status tag**  
[LIVE]

**Code references**  
`app/middleware/league_owner_middleware.ts`, `start/routes.ts`, `app/controllers/auth_users_controller.ts`; mobile: `app/(app)/(tabs)/manage.tsx`, `app/(app)/manage/[leagueId]/index.tsx`.

#### [LIVE] Team Admin

**What it is**  
A team admin is an authenticated user assigned by the league owner to a team. Team admins can manage lineups and access the match-day route for their assigned team.

**How the user does it**
1. League owner opens a team edit sheet.
2. Owner searches users by name/email.
3. Owner assigns or removes team admins.
4. Assigned team admin sees the team in Manage and opens its lineup/match hub.

**Key rules & constraints**
- Team admins are stored in `team_admins`.
- `LineupManagerMiddleware` allows either the league owner or an active team admin for one of the game's teams.
- The backend service further scopes team admins to their own team.
- Full league management is still owner-gated.

**Status tag**  
[LIVE]

**Code references**  
`app/middleware/lineup_manager_middleware.ts`, `app/controllers/team_admins_controller.ts`, `app/services/team_admin_service.ts`; mobile: `src/manage/components/teams/TeamAdminsSection.tsx`, `app/(app)/(tabs)/manage.tsx`, `app/(app)/manage/[leagueId]/team/[teamId]/index.tsx`.

#### [LIVE] Player

**What it is**  
A player is a profile subject connected to a user account and roster entries. Players get permanent public profiles with teams, seasons, matches, and career stats.

**How the user does it**
1. Receive a league invite link/code from an organizer.
2. Sign in or create an account.
3. If no player profile exists, complete profile creation.
4. Join the team roster and later view their player profile from Profile or public pages.

**Key rules & constraints**
- Player profile creation currently happens through invite acceptance.
- Player profiles include name, country, avatar URL field, bio field in schema, and roster/stat history.
- The profile screen tells users that profiles are created when accepting a league invite.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/invites_controller.ts`, `app/controllers/players_controller.ts`, `app/services/player_service.ts`; mobile: `app/(app)/join-league.tsx`, `app/join/create-profile.tsx`, `app/(app)/profile.tsx`, `app/(app)/player/[id].tsx`.

## 2. Core Concepts Glossary

- **League**: The top-level competition owned by one organizer. It has settings, teams, seasons, venues, standings, and stages.
- **Season**: A campaign inside a league. Seasons can be inactive, active, or completed. Activating one season completes other active seasons in that league.
- **Team**: A club/squad inside a league. Teams are reused across seasons for fixtures, rosters, standings, and invites.
- **Player**: A person with a persistent player profile and roster memberships across leagues/seasons/teams.
- **League player / roster row**: The membership connecting a player to a league, season, and usually a team, with jersey number, position, captain flag, and status.
- **Game / match / fixture**: A scheduled contest between a home team and away team. Games hold score, status, venue, stage/tie metadata, stats, lineups, and penalty shootout score.
- **Standing / table**: Cached ranking rows for round-robin stages. The backend recomputes them from completed round-robin results.
- **Venue**: A reusable league location. Can be name-only, mapped by dropped pin, or selected from Google Places when configured.
- **One-off venue**: A plain venue name saved directly on a game without creating a reusable venue record.
- **Stage**: A competition phase inside a season. Implemented live stage types are `round_robin` and `knockout`; `group` and `playoff` are schema-only.
- **Round-robin**: A league-table stage where games count toward standings.
- **Knockout**: A bracket stage made of ties. Winners advance round by round.
- **Tie**: A knockout matchup between two teams, possibly single match, two-legged, or best-of-N.
- **Leg**: One game inside a multi-game tie.
- **Seed**: A team's bracket order. The top team in the seeding list is seed #1.
- **Bye**: An automatic advancement when bracket size exceeds team count. Top seeds receive byes.
- **Round**: Bracket round values include Round of 256/128/64/32/16, quarter-final, semi-final, final, and third place.
- **Stat type**: A tracked event category such as goal, assist, card, save, or substitution.
- **Lineup**: A submitted team sheet with formation, 11 starters, and up to 12 substitutes.
- **Team admin**: A delegated user who can manage a team's lineups and match day.
- **Favourite**: A signed-in user's pinned league on the home feed.
- **Country**: Discovery grouping for leagues and players.

## 3. Accounts & Authentication

### [LIVE] Email OTP Sign-In And Signup

**What it is**  
Users authenticate by email code. Existing users request an OTP. New users must provide a name, and may optionally provide a recovery email.

**How the user does it**
1. Enter email on the login screen.
2. If the email is unknown, the app asks for name and optional recovery email.
3. Backend sends a 6-digit OTP.
4. User enters the OTP.
5. App stores a 30-day bearer token and user profile.

**Key rules & constraints**
- OTP codes expire after 10 minutes.
- Requesting a new OTP marks old unused OTP codes for that email as used.
- New user creation happens during OTP request when name is supplied.
- Backend returns HTTP 428 with `requiresSignup: true` when an unknown email is submitted without a name.
- API tokens are created through the Adonis access-token guard and expire in 30 days.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/auth_controller.ts`, `app/services/otp_service.ts`, `app/validators/auth.ts`, `config/auth.ts`; mobile: `app/(auth)/login.tsx`, `app/(auth)/otp.tsx`, `src/auth/AuthProvider.tsx`, `src/auth/auth-api.ts`.

### [LIVE] Account Recovery

**What it is**  
A user can request a sign-in code using their recovery email. The OTP is sent to the primary account email.

**How the user does it**
1. Open forgot/recovery screen.
2. Enter recovery email.
3. Receive OTP at the primary email.
4. Enter primary email and OTP on the OTP screen.

**Key rules & constraints**
- Recovery looks up `User.recoveryEmail`.
- The app explains recovery email at profile level, but there is no mobile UI found to edit recovery email after signup.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/auth_controller.ts`, `app/services/otp_service.ts`; mobile: `app/(auth)/forgot.tsx`, `src/auth/components/OtpScreen.tsx`, `app/(app)/profile.tsx`.

### [LIVE] Logout And Account Deletion

**What it is**  
Signed-in users can log out or delete their account.

**How the user does it**
1. Open Profile.
2. Choose Log out, or Delete account.
3. Confirm destructive action.

**Key rules & constraints**
- Logout invalidates the current API token.
- Delete account removes the user's player profile, OTP rows, nulls invited-user references on invites, and deletes the user.
- The mobile app clears local auth and query cache after logout/delete.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/auth_controller.ts`, `src/auth/AuthProvider.tsx`, `app/(app)/profile.tsx`.

## 4. Leagues

### [LIVE] Create A League Or Knockout Competition

**What it is**  
An organizer can create a new competition from the app. The creation wizard supports a league/round-robin competition or a knockout competition.

**How the user does it**
1. Open Create tab.
2. Sign in if prompted.
3. Enter competition name, country, dates, format, and optional logo/settings.
4. Add at least two teams.
5. Review and create.

**Key rules & constraints**
- League creation creates the first season.
- For normal leagues, the backend creates/ensures a round-robin stage and zeroed standings rows.
- For knockout competitions, the app can send knockout config and seeding. With enough teams, the backend creates the knockout stage and bracket.
- Team logos and league logos are supported by app payloads and backend upload fields.
- Gender/division exists as a league setting in mobile; backend validator accepts gender.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/leagues_controller.ts`, `app/services/league_service.ts`, `app/validators/league.ts`; mobile: `app/(app)/(tabs)/create.tsx`, `src/league/components/CompetitionFormatPicker.tsx`, `src/league/TiebreakerPicker.tsx`.

### [LIVE] Manage League Settings

**What it is**  
Owners can edit league name, description, dates, division/gender, and standings tiebreaker.

**How the user does it**
1. Open Manage.
2. Select an owned league.
3. Open Settings.
4. Edit fields and save.

**Key rules & constraints**
- League duration validates `YYYY-MM-DD` dates and end date must be on/after start.
- Changing tiebreaker triggers standings re-sort for the active season.
- Settings apply to the whole league, not just the selected season.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/leagues_controller.ts`, `app/services/league_service.ts`, `app/validators/league.ts`, `app/services/standing_service.ts`; mobile: `src/manage/components/tabs/ManageSettingsTab.tsx`.

### [LIVE] Public League Page

**What it is**  
Viewers can open a league page with overview, matches, standings, bracket where relevant, stats, and season picker.

**How the user does it**
1. Tap a league from home/search/country/team/player.
2. Switch seasons.
3. Use tabs based on available stages.

**Key rules & constraints**
- Matches and standings tabs show when the season has a round-robin stage.
- Bracket tab shows when the season has knockout stages.
- Stats tab is always present.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/leagues_controller.ts`, `app/transformers/league_detail_transformer.ts`; mobile: `app/(app)/league/[id].tsx`, `src/league/components/tabs/*`.

### [LIVE] Favourite Leagues

**What it is**  
Signed-in users can pin leagues to the home feed.

**How the user does it**
1. Tap the heart on a league card.
2. If logged out, app opens auth gate.
3. Favourite leagues appear in the Favourites section.

**Key rules & constraints**
- Favourite/unfavourite requires bearer auth.
- Public feed accepts optional bearer auth so favourites can be decorated when logged in.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/favourite_leagues_controller.ts`, `app/services/favourite_league_service.ts`; mobile: `src/home/components/CountryAccordion.tsx`, `src/home/components/FavoriteLeagueCard.tsx`, `src/home/api/leagues.ts`.

## 5. Seasons

### [LIVE] Create And Switch Seasons

**What it is**  
A league can run over time through multiple seasons. Owners can create new seasons and mark them inactive, active, or completed.

**How the user does it**
1. Open Manage > Settings.
2. Enter new season name.
3. Pick initial status.
4. Pick format: League/round-robin or Knockouts.
5. Add the season.

**Key rules & constraints**
- Each season has its own fixtures, roster, standings, and stages.
- Marking a season active automatically completes any other active season in the same league.
- Creating a league-format season ensures a round-robin stage.
- Creating a knockout-format season creates a knockout stage, but may require seeding before bracket play.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/seasons_controller.ts`, `app/validators/season.ts`, `app/services/stage_service.ts`; mobile: `src/manage/components/tabs/ManageSettingsTab.tsx`, `src/manage/components/seasons/EditSeasonSheet.tsx`.

## 6. Teams & Players

### [LIVE] Add, Edit, And Delete Teams

**What it is**  
Owners can add teams, update names/logos, and delete teams.

**How the user does it**
1. Open Manage > Teams.
2. Tap Add team, or edit/delete an existing team.
3. Optionally assign team admins while editing.

**Key rules & constraints**
- Teams belong to the whole league.
- Deleting a team cascades through related games, standings, roster entries, stats, and invites per mobile warning and backend model/database behavior.
- The app warns that at least two teams are needed to schedule games.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/teams_controller.ts`, `app/services/team_service.ts`, `database/migrations/*create_teams*`; mobile: `src/manage/components/tabs/ManageTeamsTab.tsx`, `src/manage/components/teams/TeamFormSheet.tsx`.

### [LIVE] Invite Players To Rosters

**What it is**  
Owners invite players to a team roster by generating a shareable invite link/code. Players accept the link, create a profile if needed, and join the roster.

**How the user does it**
1. Owner opens Manage > Players.
2. Tap Invite to team.
3. Select team and generate invite link.
4. Share link/code with player.
5. Player opens link or pastes code in Join League.
6. Player signs in and completes profile if required.

**Key rules & constraints**
- Invites expire after 7 days.
- Backend generates `/join/{token}`; mobile converts it to `sportykore://join-league?token=...`.
- Invite links can carry league/team context labels.
- If the user has no player profile, backend returns `requiresProfile`; app routes to profile creation.
- Invites are not emailed automatically by backend; they are copied/shared by the organizer.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/invites_controller.ts`, `app/services/invite_service.ts`; mobile: `src/invite/components/InviteLinkSheet.tsx`, `src/invite/invite-utils.ts`, `app/(app)/join-league.tsx`, `app/join/create-profile.tsx`.

### [LIVE] Manage Roster Rows

**What it is**  
Owners can view a season roster, filter by team, edit jersey number, position, captain flag, and remove roster entries.

**How the user does it**
1. Open Manage > Players.
2. Pick a team.
3. Tap a player row to edit.
4. Long-press/remove to delete from roster.

**Key rules & constraints**
- Roster row statuses include active, transferred, injured, suspended, pending, inactive.
- Mobile edit exposes jersey, position, and captain flag; status is displayed but not edited in the observed mobile sheet.
- Positions are attack, midfield, defence, goalkeeper.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/league_players_controller.ts`, `app/validators/league_player.ts`, `database/migrations/*create_league_players*`; mobile: `src/manage/components/tabs/ManagePlayersTab.tsx`.

### [LIVE] Public Team Pages

**What it is**  
Viewers can open team profiles showing overview, squad, matches, and standings context.

**How the user does it**
1. Tap a team from a league, match, standings table, player career, or search.
2. Switch tabs to inspect squad and fixtures.

**Key rules & constraints**
- Team details are public.
- Team games and roster are grouped by season in backend data.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/teams_controller.ts`, `app/services/team_service.ts`; mobile: `app/(app)/team/[id].tsx`, `src/team/components/tabs/*`.

### [LIVE] Public Player Profiles And Career Stats

**What it is**  
Players have permanent public profiles with season stats, career totals, clubs, and fixtures.

**How the user does it**
1. Open a player profile from a match event, squad, search, or Profile screen.
2. Use Overview, Matches, and Career tabs.
3. Switch league/season when the player has multiple memberships.

**Key rules & constraints**
- Backend aggregates memberships, stats, and team games by league and season.
- Career totals are computed from stat rows, not from penalty shootout scores.
- Player country is shown when present.
- Player avatar URL exists in backend, but mobile profile page currently renders initials rather than remote avatar.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/players_controller.ts`, `app/services/player_service.ts`, `app/transformers/player_league_detail_transformer.ts`; mobile: `app/(app)/player/[id].tsx`, `src/player/components/tabs/*`.

### [BACKEND-ONLY] Direct Player Assignment / Pending League Player Requests

**What it is**  
Backend routes can assign a player directly to a team or create pending membership records, and users can accept league-player requests.

**How the user does it**
- No clear mobile UI flow found for this path. The shipped app uses invite links instead.

**Key rules & constraints**
- `assignTeam` is owner-gated.
- `acceptLeaguePlayerRequest` exists, but the mobile app does not appear to surface it.
- `leaguePlayerRequests` appears suspicious: it filters `player_id` by `user.id`, which may be wrong unless player IDs and user IDs align.

**Status tag**  
[BACKEND-ONLY]

**Code references**  
`app/controllers/players_controller.ts`, `start/routes.ts`; mobile: no matching live screen found.

## 7. Venues

### [LIVE] Saved Venues

**What it is**  
Owners can create reusable league venues for fixtures. Venues can be name-only, manually pinned on a map, or selected from Google Places.

**How the user does it**
1. Open Manage > Venues.
2. Tap Add venue.
3. Choose Search Google Places, Drop pin on map, or Name only.
4. Save venue.
5. Edit or delete later.

**Key rules & constraints**
- Captured fields: name, address, city, capacity, notes, latitude, longitude, Google Place ID.
- Google Places search requires `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`; otherwise app tells the user to use pin or name-only.
- Venue create/update/delete is owner-gated.
- Venue coordinates are transformed to numbers in API responses.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/venues_controller.ts`, `app/validators/venue.ts`, `app/transformers/venue_transformer.ts`, `database/migrations/1778517000000_create_venues_table.ts`; mobile: `src/manage/components/tabs/ManageVenuesTab.tsx`, `src/manage/components/venues/VenueFormSheet.tsx`.

### [LIVE] Attach Saved Or One-Off Venue To A Game

**What it is**  
A fixture can reference a saved venue or carry a one-off venue name.

**How the user does it**
1. Create or edit a game.
2. Use Venue picker.
3. Choose No venue, saved league venue, add a new venue inline, or type a one-off venue name.

**Key rules & constraints**
- Saved venue must belong to the same league.
- When saved venue is attached, backend snapshots `venueName` from the venue.
- One-off venue only sends `venueName`; it does not create a venue record.
- Deleting a saved venue sets `venue_id` null on games, but existing games keep the venue name and lose the map link.
- Public match pages show venue name/address and map/directions if coordinates exist.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/games_controller.ts`, `app/services/game_service.ts`, `app/validators/game.ts`, `database/migrations/1778517990137_create_games_table.ts`; mobile: `src/manage/components/games/GameVenuePicker.tsx`, `src/match/components/tabs/OverviewTab.tsx`.

## 8. Match Day - Live Match Center

### [LIVE] Create And Manage Fixtures

**What it is**  
Owners schedule fixtures with teams, kickoff date/time, half durations, and venue.

**How the user does it**
1. Open Manage > Games.
2. Tap Add game.
3. Pick home/away teams, date/time, half durations, and venue.
4. Save.
5. Later edit/delete or open Live Match Center.

**Key rules & constraints**
- Home and away team must differ.
- Games created through round-robin management ensure/use a round-robin stage.
- App defaults first and second half duration to 45 minutes.
- Editing score from game list is possible, and app warns that deleting stats does not automatically adjust score.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/games_controller.ts`, `app/validators/game.ts`, `app/services/game_service.ts`; mobile: `src/manage/components/games/AddGameSheet.tsx`, `src/manage/components/games/EditGameSheet.tsx`, `src/manage/components/games/ManageGameRow.tsx`.

### [LIVE] Match Clock And Status Flow

**What it is**  
Owners run the match clock from the phone: first half, half time, second half, extra time, penalties, pause/resume, and full time.

**How the user does it**
1. Open a scheduled game in Live Match Center.
2. Tap Start first half.
3. Progress through Half time and Start second half.
4. Optionally choose Extra time or Penalties.
5. Confirm full-time score or penalty scores.

**Key rules & constraints**
- Scheduled/postponed -> first half.
- First half -> half time.
- Half time -> second half.
- Second half -> full time, extra time, penalties, or pause.
- Extra time -> full time, penalties, or pause.
- Penalty shootout -> enter unequal penalty scores to complete.
- Pause stores previous active status and resume shifts the period start time by pause duration.
- Full-time can derive `winnerTeamId` when the score or penalty score is decisive.
- Knockout ties advance after full-time/shootout completion where applicable.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/game_time_controller.ts`, `app/services/game_time_service.ts`, `database/migrations/1778517990137_create_games_table.ts`; mobile: `src/manage/components/GameControls.tsx`, `app/(app)/manage/[leagueId]/game/[gameId].tsx`.

### [LIVE] Live Scoring And Goal Accreditation

**What it is**  
The match center separates fast scorekeeping from later attribution. Tapping +/- updates the scoreboard. A new goal creates an uncredited goal stat, then the organizer can attach scorer, assist, minute, or own-goal flag.

**How the user does it**
1. In Score tab, tap + for the scoring side.
2. Select scorer from active roster.
3. Optionally select assist.
4. Adjust minute.
5. Toggle own goal if needed.
6. Log goal or skip attribution.

**Key rules & constraints**
- Increment creates an uncredited `goals` stat row.
- Decrement removes the latest uncredited goal placeholder for that team.
- Accredit only works on uncredited goal placeholder stats.
- Assists are not allowed on own goals.
- Scorer and assist cannot be the same player.
- Players must be active on one of the game teams.
- Own goals convert the goal stat type to `own_goal`.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/game_score_controller.ts`, `app/services/game_score_service.ts`; mobile: `app/(app)/manage/[leagueId]/game/[gameId].tsx`, `src/manage/components/hybrid-scoring/HybridScoringPanel.tsx`, `src/manage/utils/stats.ts`.

### [LIVE] Record Cards, Saves, And Substitutions

**What it is**  
The match center records non-goal events as stat rows: yellow/red cards, goalkeeper saves, and substitution pairs.

**How the user does it**
1. Open Stats tab.
2. Enter event minute.
3. Pick Cards or Saves.
4. Tap yellow/red/save beside a player.
5. For substitutions, use the Lineup tab substitution panel to pick player off/on and minute.

**Key rules & constraints**
- Cards can be recorded for active roster players.
- Saves are filtered to goalkeepers in the mobile UI.
- Substitutions create paired `substitution_off` and `substitution_on` stats.
- Substitutions require a submitted lineup: player off must be a starter, player on must be a substitute.
- Substitution events do not mutate the displayed starting lineup; the app explicitly says the starting lineup on the pitch stays unchanged.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/stats_controller.ts`, `app/services/stat_service.ts`, `database/migrations/1778519204153_create_stat_types_table.ts`; mobile: `src/manage/components/hybrid-scoring/MatchCenterStatsTab.tsx`, `src/manage/components/hybrid-scoring/MatchCenterSubstitutionPanel.tsx`.

### [LIVE] Public Match Page

**What it is**  
Public viewers can inspect a match overview, lineups, and team stats/events.

**How the user does it**
1. Open a match from home, league, team, player, or search.
2. View Overview, Lineups, or Stats.

**Key rules & constraints**
- Overview shows teams, score when relevant, phase, kickoff, venue, address, map/directions when coordinates exist, and event timeline.
- Lineups show submitted team sheets; otherwise a "not submitted yet" state.
- Stats tab buckets event counts by stat type and team.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/games_controller.ts`, `app/controllers/game_lineups_controller.ts`; mobile: `app/(app)/match/[id].tsx`, `src/match/components/tabs/*`.

### [LIVE] Real-Time Updates Via SSE

**What it is**  
The app listens for live game updates and refreshes affected views.

**How the user does it**
- No manual action. Opening relevant screens subscribes to game channels.

**Key rules & constraints**
- Backend registers Adonis Transmit routes.
- Game model dispatches `GameUpdated`; score/time/stat services broadcast game events.
- Mobile subscribes to game channels discovered from query cache or explicit match center listener.
- Match Center applies local patches for score/status and invalidates public live queries.

**Status tag**  
[LIVE]

**Code references**  
`start/routes.ts`, `app/models/game.ts`, `app/events/game_updated.ts`, `app/listeners/update_standings.ts`; mobile: `src/lib/transmit/TransmitProvider.tsx`, `src/lib/transmit/manager.ts`, `src/lib/transmit/useTransmitGameListener.ts`, `app/(app)/manage/[leagueId]/game/[gameId].tsx`.

## 9. Stats & Player Profiles

### [LIVE] Tracked Stat Types

**What it is**  
Sportykore tracks core match events used by match pages and player profiles.

**How the user does it**
- Goals are recorded through score + accreditation.
- Assists are added during goal accreditation.
- Cards, saves, and substitutions are recorded from Match Center tabs.

**Key rules & constraints**
- Seeded stat types: goals, own goal, assists, yellow card, red card, saves, shots on target, fouls conceded, substitution on, substitution off.
- Mobile match center exposes goals, assists, own goals, yellow/red cards, saves, and substitutions.
- Shots on target and fouls conceded exist as stat types but no direct mobile control was found in the current match center.

**Status tag**  
[LIVE] for exposed types; [BACKEND-ONLY] for stat types without mobile controls.

**Code references**  
`database/migrations/1778519204153_create_stat_types_table.ts`, `app/services/stat_service.ts`; mobile: `src/manage/components/hybrid-scoring/MatchCenterStatsTab.tsx`, `src/manage/utils/games.ts`.

### [LIVE] Goals, Assists, Own Goals, And Career Totals

**What it is**  
Player profiles compute season and career totals from stat rows.

**How the user does it**
1. Organizer records/accredits match events.
2. Viewer opens player profile.
3. App shows season totals and career totals.

**Key rules & constraints**
- Career totals count `goals`, `assists`, and card stats by aggregating stat rows.
- Own goals are a separate stat type and should not be treated as normal player goals by documentation unless app utility code explicitly counts them. The match event is stored as `own_goal`.
- Player profile games are derived from both player stats and team memberships.

**Status tag**  
[LIVE]

**Code references**  
`app/services/player_service.ts`, `app/transformers/stat_transformer.ts`; mobile: `src/player/utils.ts`, `src/player/components/tabs/OverviewTab.tsx`, `src/player/components/tabs/CareerTab.tsx`.

### [LIVE] In-Play Penalties Versus Shootout Penalties

**What it is**  
The current system distinguishes ordinary match goals from penalty shootout results by data model. An in-play penalty, if recorded, is just a normal goal stat. A shootout penalty is stored only as a shootout score on the game.

**How the user does it**
- For an in-play penalty: use normal score + goal accreditation. There is no dedicated "penalty goal" stat type or UI.
- For a shootout: enter penalty scores in the Penalty shootout modal.

**Key rules & constraints**
- In-play penalties count as career goals only because they are recorded as normal `goals`.
- Shootout penalties do **not** create `goals` stat rows and therefore do **not** count toward player career goals.
- The app does not record individual shootout takers or scored/missed attempts.
- There is no separate "penalty scored" or "penalty missed" stat type in the seeded stat types.

**Status tag**  
[LIVE] for the shootout-vs-stat distinction; [BACKEND-ONLY/not implemented] for dedicated in-play penalty event type or individual shootout takers.

**Code references**  
`app/services/game_score_service.ts`, `app/services/game_time_service.ts`, `database/migrations/1778517990137_create_games_table.ts`, `database/migrations/1778519204153_create_stat_types_table.ts`; mobile: `src/manage/components/GameControls.tsx`, `app/(app)/manage/[leagueId]/game/[gameId].tsx`.

## 10. Standings

### [LIVE] Automatic Round-Robin Table

**What it is**  
Sportykore computes league tables automatically from completed round-robin results.

**How the user does it**
1. Schedule round-robin games.
2. Run matches to full time.
3. Public league standings update after results.

**Key rules & constraints**
- Standings are cached in `standings` rows, not computed only at request time.
- Recalculation uses full-time games in the round-robin stage.
- Knockout/tie games do not affect standings.
- Points: win = 3, draw = 1, loss = 0.
- Table fields include played, wins, draws, losses, goals for, goals against, goal difference, points, position, and form.
- Form is computed as last five outcomes joined by commas, e.g. `W,D,L`.

**Status tag**  
[LIVE]

**Code references**  
`app/services/standing_service.ts`, `app/listeners/update_standings.ts`, `database/migrations/1778982577473_create_standings_table.ts`; mobile: `src/league/components/tabs/StandingsTab.tsx`.

### [LIVE] Tiebreaker Presets

**What it is**  
Owners can choose how tied teams are sorted after points.

**How the user does it**
1. Open Manage > Settings.
2. Pick tiebreaker preset.
3. Save league.

**Key rules & constraints**
- Points always rank first.
- Supported criteria include goal difference, goals scored, wins, goals conceded, away goals scored, and head-to-head mini-league variants.
- Changing tiebreaker re-sorts active season standings immediately.
- Final fallback is team ID order.

**Status tag**  
[LIVE]

**Code references**  
`app/types/tiebreaker.ts`, `app/services/standing_tiebreaker.ts`, `app/services/league_service.ts`; mobile: `src/league/tiebreaker-options.ts`, `src/league/components/TiebreakerPicker.tsx`, `src/manage/components/tabs/ManageSettingsTab.tsx`.

### Not Found: Point Deductions, Manual Adjustments, Promotion/Relegation Zones

No implemented schema, backend logic, or mobile UI was found for point deductions, manual table adjustments, promotion zones, relegation zones, or playoff-zone highlighting. These should not be documented as available or planned unless product confirms them outside this codebase.

## 11. Competition Formats (Stages)

### [LIVE] Round-Robin League Stage

**What it is**  
A round-robin stage is the normal league table format. Fixtures count toward standings when completed.

**How the user does it**
1. Create a League/round-robin competition, or create a league-format season.
2. Add teams.
3. Schedule games.
4. Run games to full time.
5. View standings.

**Key rules & constraints**
- Backend ensures a round-robin stage for league-format seasons and game scheduling.
- Standings only recalculate from round-robin stage games.
- The app shows Matches and Standings tabs when a round-robin stage exists.

**Status tag**  
[LIVE]

**Code references**  
`app/services/stage_service.ts`, `app/services/standing_service.ts`, `app/controllers/games_controller.ts`; mobile: `app/(app)/league/[id].tsx`, `src/manage/components/tabs/ManageGamesTab.tsx`.

### [LIVE] Knockout Competition / Bracket

**What it is**  
A knockout stage is a bracket competition where teams are seeded once, ties create fixtures, winners advance, and the bracket can include byes and a third-place playoff.

**How the user does it**
1. Create a knockout competition or knockout season.
2. Choose tie format: single match, home & away, best of 3, or custom best of N.
3. Optionally turn on third-place playoff.
4. Seed teams in order.
5. Run tie games from Match Center.
6. Generate next round when the current round is complete.
7. Mark the stage complete after final/third-place requirements are met.

**Key rules & constraints**
- A stage must be seeded with at least two unique teams.
- Seeding is one-time: after ties exist, backend rejects reseeding with 409.
- Bracket size is next power of two.
- Top seeds receive byes.
- Byes create completed ties with no games.
- Single-match ties require a winner.
- Two-legged ties aggregate goals relative to tie home/away; optional away-goals tiebreak exists.
- If two-legged aggregate remains tied, second-leg winner decides, usually after penalties.
- Best-of ties create the first game first, then dynamically create the next leg after each full-time game until a team reaches target wins or all games are played.
- Best-of home side alternates by leg.
- Next-round generation is explicit owner action and idempotent if the next round already exists.
- Third-place tie is generated from semi-final losers when configured.
- Public league pages show bracket tab; manage bracket lets owner open tie games.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/stages_controller.ts`, `app/services/stage_service.ts`, `app/services/bracket_service.ts`, `app/services/tie_resolver.ts`, `app/types/stage.ts`; mobile: `src/manage/components/tabs/ManageKnockoutTab.tsx`, `src/knockout/components/KnockoutTieFormatControl.tsx`, `src/knockout/components/BracketView.tsx`, `src/league/components/tabs/BracketTab.tsx`.

### [BACKEND-ONLY] Add-On Knockout Stage For A Round-Robin Season

**What it is**  
Backend supports creating knockout stages under a season, which could theoretically add a cup/playoff bracket after or alongside a league stage.

**How the user does it**
- No reliable mobile path found for adding a knockout stage to an existing round-robin season. The manage Knockout tab is only shown when the selected season has knockout and no round-robin stage.

**Key rules & constraints**
- Route exists: owner can `POST /api/v1/leagues/:leagueId/stages`.
- Mobile `ManageKnockoutTab` has "Add cup" UI, but league manage routing appears to hide the Knockout tab for round-robin seasons.
- Do not document this as a public app feature yet.

**Status tag**  
[BACKEND-ONLY]

**Code references**  
`start/routes.ts`, `app/controllers/stages_controller.ts`, `app/services/stage_service.ts`; mobile: `app/(app)/manage/[leagueId]/index.tsx`, `src/manage/components/tabs/ManageKnockoutTab.tsx`.

### [SCHEMA-READY] Group Stages

Group stage enum/schema fields exist, but no backend generation, standings grouping behavior, or mobile setup flow was found. Do not document as available. See Appendix A.

### [SCHEMA-READY] Playoff Stages

Playoff stage enum/schema fields exist, but no runnable backend/mobile playoff format was found. Do not document as available. See Appendix A.

## 12. Offline-First Behavior

### [LIVE] Persisted Read Cache

**What it is**  
The mobile app persists query data so recently loaded screens can still show data without a fresh network response.

**How the user does it**
1. Browse leagues/matches/teams/players while online.
2. Later open the app with limited/no connectivity.
3. Previously cached data can remain visible.

**Key rules & constraints**
- TanStack Query cache persists to AsyncStorage key `SOCCER_APP_CACHE`.
- Cached data is kept for up to 24 hours.
- Default stale time is 5 minutes.
- Reads may use cached data when offline.
- This is not a full offline write/sync system.

**Status tag**  
[LIVE]

**Code references**  
`src/lib/query-client.ts`, `app/_layout.tsx`.

### Not Implemented: Offline Mutation Queue

There is no evidence of queued offline writes for creating leagues, scoring games, recording stats, or editing rosters. Match-day writes call the API directly and require connectivity. Do not market "offline-first" as offline scorekeeping with later sync unless this is built elsewhere outside the read code.

## 13. Notifications & Email

### [LIVE] OTP Email

**What it is**  
Users receive OTP codes by email for login/signup/recovery.

**How the user does it**
1. Request sign-in code.
2. Check email.
3. Enter code.

**Key rules & constraints**
- Backend logs OTP and sends `OTPNotification`.
- OTP expires in 10 minutes.

**Status tag**  
[LIVE]

**Code references**  
`app/services/otp_service.ts`, `app/mails/otp_notification.ts`.

### [LIVE] Welcome Email

**What it is**  
New users receive a welcome email after verifying OTP.

**How the user does it**
- No manual action. It sends after new account verification.

**Key rules & constraints**
- Backend treats users created within the last 10 minutes as new and sends welcome email with `sendLater`.

**Status tag**  
[LIVE]

**Code references**  
`app/services/otp_service.ts`, `app/mails/welcome_notification.ts`.

### [LIVE] League Created And Team Admin Emails

**What it is**  
Backend sends transactional emails after league creation and team-admin assignment.

**How the user does it**
- Organizer creates a league or assigns a team admin.

**Key rules & constraints**
- Team-admin email is tied to assignment flow.
- League-created email uses app URL settings.
- No push notification system was found.

**Status tag**  
[LIVE]

**Code references**  
`app/services/league_service.ts`, `app/mails/league_created_notification.ts`, `app/services/team_admin_service.ts`, `app/mails/team_admin_assigned_notification.ts`.

### [LIVE] Invite Sharing But No Invite Email

**What it is**  
Player invites are generated as links/codes for manual sharing.

**How the user does it**
1. Generate invite link.
2. Copy/share it outside the app.

**Key rules & constraints**
- No backend mail send was found in invite generation.
- Invite UI copies/deep-links, it does not send email itself.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/invites_controller.ts`, `app/services/invite_service.ts`; mobile: `src/invite/components/InviteLinkSheet.tsx`.

## 14. Anything Else In The Code

### [LIVE] Country Discovery

**What it is**  
Users can browse competitions by country and open country pages.

**How the user does it**
1. Use home country filters/accordion.
2. Open country page from search or league/player metadata.

**Key rules & constraints**
- Countries are public API resources.
- League feed supports date, match day, country, and timezone handling.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/countries_controller.ts`, `app/controllers/leagues_controller.ts`; mobile: `src/country/api.ts`, `app/(app)/country/[id].tsx`, `src/home/hooks/useLeaguesByCountry.ts`.

### [LIVE] Global Search

**What it is**  
Users can search across players, countries, leagues, and teams.

**How the user does it**
1. Tap search on home.
2. Enter query.
3. Open grouped result.

**Key rules & constraints**
- Empty query returns empty result list.
- Limit defaults to 24 and maxes at 100.
- Mobile stores recent searches locally.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/searches_controller.ts`, `app/services/search_service.ts`; mobile: `app/(app)/search.tsx`, `src/home/api/search.ts`, `src/home/recent-searches.ts`.

### [LIVE] Lineup Builder

**What it is**  
Owners and team admins can submit official team sheets with formation, starters, and substitutes.

**How the user does it**
1. Open team lineup hub from Manage or team admin route.
2. Pick formation.
3. Fill exactly 11 starters into formation slots.
4. Add up to 12 substitutes.
5. Save lineup.

**Key rules & constraints**
- Must have exactly 11 starters.
- Formation slots must be filled.
- Max 12 substitutes.
- Players must be unique.
- Lineups are locked when game is full-time or cancelled.
- Team admins are scoped to their assigned team.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/game_lineups_controller.ts`, `app/services/lineup_service.ts`, `database/migrations/1782100000001_create_game_lineups_table.ts`; mobile: `app/(app)/manage/[leagueId]/team/[teamId]/lineup/[gameId].tsx`, `src/lineup/components/*`.

### [LIVE] Formations

**What it is**  
The backend exposes seeded football formations used by the lineup builder.

**How the user does it**
- Pick a formation in lineup builder.

**Key rules & constraints**
- Formation endpoints are public.
- Formation records include slots/positions used by lineup validation.

**Status tag**  
[LIVE]

**Code references**  
`app/controllers/formations_controller.ts`, `database/data/formations.ts`; mobile: `src/lineup/components/FormationChips.tsx`, `src/lineup/components/LineupPitchView.tsx`.

## Appendix A. Planned / Not Yet Available

### [SCHEMA-READY] Group Stages

- Schema enum includes `stage_type = group`.
- `stage_groups` and `stage_group_id` columns exist in stage/team/game/standing shapes.
- No group-stage creation logic, group draw UI, grouped standings UI, or progression logic was found.
- Do not write public docs for group stages yet.

Code references: `database/migrations/1778517100000_create_stages_table.ts`, `database/migrations/*stage_groups*`, `database/migrations/1778982577473_create_standings_table.ts`.

### [SCHEMA-READY] Playoff Stages

- Schema enum includes `stage_type = playoff`.
- No playoff-specific backend service, validator flow, mobile setup UI, or docs-ready behavior found.
- Knockout brackets are live; "playoffs" as a distinct format are not.

Code references: `database/migrations/1778517100000_create_stages_table.ts`, `app/services/stage_service.ts`.

### [SCHEMA-READY] Stage Groups

- `stage_groups` and `stage_group_id` are present structurally.
- Current live standings logic uses one round-robin stage and unique season/team standings.
- No user-facing group table behavior found.

Code references: `database/migrations/*stage_groups*`, `app/services/standing_service.ts`.

### [SCHEMA-READY] Stored `current_minute`

- `games.current_minute` exists in the database.
- The live app/backend compute current minute from status timestamps and durations.
- Do not document manual current-minute storage as a feature.

Code references: `database/migrations/1778517990137_create_games_table.ts`, `app/transformers/game_transformer.ts`, `src/lib/game-time.ts`.

### [SCHEMA-READY] Lineup Subbed-In/Subbed-Out Minute Fields

- Game lineup rows include `subbed_in_minute` and `subbed_out_minute`.
- Current substitution recording creates stat events and explicitly does not mutate the starting lineup/pitch view.
- Do not document live in-line lineup substitution state yet.

Code references: `database/migrations/1782100000001_create_game_lineups_table.ts`, `app/services/stat_service.ts`, `src/manage/components/hybrid-scoring/MatchCenterSubstitutionPanel.tsx`.

## Appendix B. Gaps, Ambiguities & Open Questions

- **Database stack discrepancy**: Product anchor says PostgreSQL. Code default is SQLite; PostgreSQL is configured for Docker/compose. Public docs should avoid hard stack claims unless environment is confirmed.
- **Offline-first wording**: App has persisted read cache, not offline write queue. Do not promise offline scoring sync.
- **Mobile API URL**: `src/api/config.ts` currently hardcodes a LAN URL in the working tree, while project docs expect environment config. This may be local/dev work.
- **Navigation/auth discrepancy**: App group routing is guarded mainly by onboarding; specific actions use auth gates or login prompts. Do not imply the whole app requires login.
- **Direct pending player requests**: Backend route exists, but mobile uses invites. `leaguePlayerRequests` may contain a bug filtering player ID by user ID.
- **Recovery email editing**: Recovery email is collected at signup and used for recovery, but no mobile edit flow was found.
- **Dedicated penalty event type**: No stat type/UI distinguishes in-play penalty goals from normal goals.
- **Individual shootout takers**: Shootouts store only team penalty totals, not taker-level attempts.
- **Shots on target/fouls conceded**: Seeded stat types exist, but current mobile match-center controls do not expose them.
- **Promotion/relegation/point adjustments**: No schema or live implementation found.
- **Add-on cup after league stage**: Backend can create extra knockout stages, but mobile route visibility makes this not clearly usable for round-robin seasons.
- **Quality checks observed**: Mobile TypeScript and tests passed in the read session; mobile lint had an existing unescaped apostrophe error. Backend typecheck had existing errors unrelated to this documentation pass.

## Recommended Documentation Page Map

Use [LIVE] features for public docs. Mention [BACKEND-ONLY] only in internal/admin API docs.

1. **Getting Started**
   - What Sportykore is
   - Roles: viewer, organizer, team admin, player
   - Sign in with email code
2. **Create Your First Competition**
   - Create a league
   - Choose round-robin or knockout
   - Add teams and logos
3. **Run Seasons**
   - Understand seasons
   - Activate/complete seasons
   - Create a new season
4. **Teams, Rosters & Invites**
   - Add teams
   - Invite players
   - Player joins with invite link
   - Edit roster details
   - Assign team admins
5. **Venues**
   - Add saved venues
   - Use Google Places, map pin, or name-only venue
   - Add venue to a fixture
   - Use one-off venue names
6. **Fixtures & Match Day**
   - Schedule a fixture
   - Start and control a live match
   - Score goals quickly
   - Credit scorers and assists
   - Record cards, saves, and substitutions
   - Finish match and handle penalties
7. **Lineups**
   - Pick formation
   - Submit starters and substitutes
   - Team admin lineup permissions
8. **Standings**
   - How tables update
   - Points and tiebreakers
   - Why knockout games do not affect standings
9. **Knockout Brackets**
   - Create a knockout competition
   - Choose tie format
   - Seed teams and understand byes
   - Run ties and generate next rounds
   - Penalties and third-place playoff
10. **Player Profiles & Stats**
   - How player profiles are created
   - Career totals
   - Goals, assists, own goals, and penalties
11. **Public Discovery**
   - Home feed
   - Countries
   - Search
   - Favourite leagues
12. **Offline & Live Updates**
   - What cached offline browsing means
   - What requires connection
   - Real-time match updates
13. **Reference / Limits**
   - Current available features
   - Not yet available: groups, playoffs, offline write sync, promotion/relegation, point deductions
