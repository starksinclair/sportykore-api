Core rules:

A player profile cannot exist without a user account
Admins cannot manually create players — they can only invite users
A user creates their own player profile after signing up

Two flows:
Flow A — Admin invites a specific user:
Admin searches for a user by name/email
↓
Selects user → selects league + season + team → generates invite
↓
System creates token tied to userId + leagueId + seasonId + teamId
↓
Admin sends link to that user
↓
User opens link → logs in or signs up
↓
If no player profile → prompt to complete it first
↓
Player profile created → added to league_players table → done
Flow B — Admin shares a general league link:
Admin generates a general invite link (no specific user)
↓
Shares anywhere (WhatsApp, SMS etc)
↓
Anyone opens it → logs in or signs up
↓
If no player profile → prompt to complete it
↓
Player profile created → added to league_players → done

Invites table key fields:
tstoken // unique UUID
league_id // required
season_id // required
team_id // required
invited_user_id // nullable — null means general invite
status // pending | accepted | expired
expires_at // 7 days
accepted_at // nullable

## API routes (manage / invite)

See [ROUTES.md](../ROUTES.md) for full shapes.

| Step | Method | Path | Auth |
| --- | --- | --- | --- |
| Search users (Flow A) | `GET` | `/api/v1/auth/users/search?q=&leagueId=` | `apiAuth` + must own `leagueId` |
| Generate invite link | `GET` | `/api/v1/invites/generate?leagueId=&seasonId=&teamId=&invitedUserId?` | `apiAuth` + `leagueOwner` |
| Accept invite | `GET` | `/api/v1/invites/accept/:token` | API or session user |
| Complete profile + accept | `POST` | `/api/v1/invites/complete-profile-and-accept/:token` | `apiAuth` |
| List season roster | `GET` | `/api/v1/leagues/:leagueId/seasons/:seasonId/roster` | `apiAuth` + `leagueOwner` |
| Update roster row | `PUT` | `/api/v1/leagues/league-players/:id` | `apiAuth` + `leagueOwner` |
| Remove from roster | `DELETE` | `/api/v1/leagues/league-players/:id` | `apiAuth` + `leagueOwner` |

`invitedUserId` is required for Flow A only (omit for Flow B). `teamId` is always required when generating an invite.
