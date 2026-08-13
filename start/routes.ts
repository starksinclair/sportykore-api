/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'
import {
  authThrottle,
  clockUpdateThrottle,
  gameUpdateThrottle,
  globalThrottle,
  inviteThrottle,
  otpRequestThrottle,
  otpVerifyThrottle,
  scoreUpdateThrottle,
  searchThrottle,
  statUpdateThrottle,
} from '#start/limiter'

const PushNotificationsController = () => import('#controllers/push_notifications_controller')

transmit.registerRoutes()

router.on('/').renderInertia('home', {}).as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

/**
 * Mobile / JSON API authentication (OTP + Bearer tokens).
 */
router
  .group(() => {
    // Deprecated, email/password + Google OAuth (see ROUTES.md)
    // router.post('signup', [controllers.Users, 'signup'])
    // router.post('login', [controllers.Users, 'login'])
    // router.post('forgot-password', [controllers.Users, 'forgotPassword'])
    // router.post('reset-password', [controllers.Users, 'resetPassword'])
    // router.get('google/redirect', [controllers.Users, 'googleRedirect'])
    // router.get('google/callback', [controllers.Users, 'googleCallback'])

    router.post('request-otp', [controllers.Auth, 'requestOtp']).use(otpRequestThrottle)
    router.post('verify-otp', [controllers.Auth, 'verifyOtp']).use(otpVerifyThrottle)
    router.post('recover', [controllers.Auth, 'requestRecovery']).use(otpRequestThrottle)
    router.post('logout', [controllers.Auth, 'logout']).use(middleware.apiAuth()).use(authThrottle)
    router.delete('account', [controllers.Auth, 'deleteAccount']).use(middleware.apiAuth())

    router
      .group(() => {
        router.get('me', [controllers.AuthUsers, 'me'])
        router.get('managed', [controllers.AuthUsers, 'managed'])
        router.get('leagues/:leagueId/teams', [controllers.AuthUsers, 'teams'])
        router.get('search', [controllers.AuthUsers, 'search'])
      })
      .prefix('users')
      .use(middleware.apiAuth())
  })
  .prefix('/api/v1/auth')
  .use(globalThrottle)

/**
 * Leagues & country-scoped discovery (JSON API).
 */
router
  .group(() => {
    router.get('countries', [controllers.Countries, 'index'])
    router.get('countries/:idOrCode', [controllers.Countries, 'show'])
    router.get('leagues', [controllers.Leagues, 'index'])
    router.get('leagues/:leagueId', [controllers.Leagues, 'show'])
    router.post('leagues', [controllers.Leagues, 'store']).use(middleware.apiAuth())
    router.get('search', [controllers.Searches, 'search']).use(searchThrottle)
    router.get('support/faqs', [controllers.Support, 'faqs'])
    router.post('support/bug-reports', [controllers.Support, 'bugReport'])
    router.post('support/faqs/seed', [controllers.Support, 'seedFaqs']).use(middleware.apiAuth())
    router
      .post('push/tokens', [PushNotificationsController, 'registerToken'])
      .use(middleware.apiAuth())
    router
      .get('leagues/:leagueId/notifications', [PushNotificationsController, 'showLeaguePreference'])
      .use(middleware.apiAuth())
    router
      .put('leagues/:leagueId/notifications', [
        PushNotificationsController,
        'updateLeaguePreference',
      ])
      .use(middleware.apiAuth())
    router.get('games/:id', [controllers.Games, 'show'])
    router.get('formations', [controllers.Formations, 'index'])
    router.get('formations/:id', [controllers.Formations, 'show'])
    router.get('games/:gameId/lineups', [controllers.GameLineups, 'index'])
    router.get('leagues/stages/:id/bracket', [controllers.Stages, 'bracket'])
    router.get('leagues/stages/:id/standings', [controllers.Stages, 'standings'])
    router.get('seasons/:seasonId/stages', [controllers.Stages, 'indexBySeason'])
    router.get('teams/:id', [controllers.Teams, 'show'])
    router
      .get('players/does-user-have-player-profile', [
        controllers.Players,
        'doesUserHavePlayerProfile',
      ])
      .use(middleware.apiAuth())
    router.get('players/:id', [controllers.Players, 'show'])

    // Own player profile (two-state CTA resolver) + personal YouTube highlights.
    // Ownership here is the authenticated user's own player record, not leagueOwner.
    router
      .group(() => {
        router.get('me/player', [controllers.MePlayer, 'show'])
        router.post('me/player', [controllers.MePlayer, 'store'])
        router.put('me/player', [controllers.MePlayer, 'update'])
        router.post('me/player/photo', [controllers.MePlayer, 'photo'])

        router.get('me/player/highlights', [controllers.PlayerHighlights, 'index'])
        router.post('me/player/highlights', [controllers.PlayerHighlights, 'store'])
        router.put('me/player/highlights/reorder', [controllers.PlayerHighlights, 'reorder'])
        router.put('me/player/highlights/:hid', [controllers.PlayerHighlights, 'update'])
        router.delete('me/player/highlights/:hid', [controllers.PlayerHighlights, 'destroy'])
      })
      .use(middleware.apiAuth())
    router.get('invites/accept/:token', [controllers.Invites, 'accept']).use(middleware.apiAuth())
    router
      .post('invites/complete-profile-and-accept/:token', [
        controllers.Invites,
        'completeProfileAndAccept',
      ])
      .use(middleware.apiAuth())

    router
      .post('leagues/accept-league-player-request', [
        controllers.Players,
        'acceptLeaguePlayerRequest',
      ])
      .use(middleware.apiAuth())
    router
      .get('leagues/league-player-requests', [controllers.Players, 'leaguePlayerRequests'])
      .use(middleware.apiAuth())
    router
      .post('leagues/:leagueId/favorite', [controllers.FavouriteLeagues, 'store'])
      .use(middleware.apiAuth())
    router
      .delete('leagues/:leagueId/favorite', [controllers.FavouriteLeagues, 'destroy'])
      .use(middleware.apiAuth())

    router
      .post('games/:gameId/score', [controllers.GameScore, 'update'])
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
      .use(scoreUpdateThrottle)

    router
      .patch('games/:gameId/stats/:statId/accredit', [controllers.GameScore, 'accredit'])
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
      .use(statUpdateThrottle)

    router
      .put('games/:gameId/awards/motm', [controllers.PlayerAwards, 'setMotm'])
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
      .use(statUpdateThrottle)

    router
      .post('games/:gameId/tracking-events', [controllers.Stats, 'recordTrackingEvents'])
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
      .use(statUpdateThrottle)

    router
      .group(() => {
        router.post('games/:gameId/start-first-half', [controllers.GameTime, 'startFirstHalf'])
        router.post('games/:gameId/half-time', [controllers.GameTime, 'startHalfTime'])
        router.post('games/:gameId/start-second-half', [controllers.GameTime, 'startSecondHalf'])
        router.post('games/:gameId/extra-time', [controllers.GameTime, 'startExtraTime'])
        router.post('games/:gameId/pause', [controllers.GameTime, 'pause'])
        router.post('games/:gameId/resume', [controllers.GameTime, 'resume'])
        router.post('games/:gameId/full-time', [controllers.GameTime, 'endGame'])
        router.post('games/:gameId/penalty-shootout', [
          controllers.GameTime,
          'startPenaltyShootout',
        ])
        router.post('games/:gameId/penalty-shootout/complete', [
          controllers.GameTime,
          'completePenaltyShootout',
        ])
      })
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
      .use(clockUpdateThrottle)

    router
      .group(() => {
        router.put('games/:gameId/lineups', [controllers.GameLineups, 'set'])
        router.patch('games/:gameId/lineups/:id', [controllers.GameLineups, 'update'])
        router.delete('games/:gameId/lineups/:id', [controllers.GameLineups, 'destroy'])
      })
      .use(middleware.apiAuth())
      .use(middleware.lineupManager())
      .use(gameUpdateThrottle)

    router
      .group(() => {
        router.put('leagues/:leagueId', [controllers.Leagues, 'update'])

        router.post('leagues/:leagueId/seasons', [controllers.Seasons, 'store'])
        router.put('leagues/:leagueId/seasons/:seasonId', [controllers.Seasons, 'update'])

        router.post('leagues/:leagueId/teams', [controllers.Teams, 'store'])
        router.put('leagues/:leagueId/teams/:id', [controllers.Teams, 'update'])
        router.delete('leagues/:leagueId/teams/:id', [controllers.Teams, 'destroy'])
        router.post('leagues/:leagueId/teams/:teamId/admins', [controllers.TeamAdmins, 'store'])
        router.delete('leagues/:leagueId/teams/:teamId/admins/:userId', [
          controllers.TeamAdmins,
          'destroy',
        ])

        router.get('leagues/:leagueId/venues', [controllers.Venues, 'index'])
        router.post('leagues/:leagueId/venues', [controllers.Venues, 'store'])
        router.put('leagues/venues/:id', [controllers.Venues, 'update'])
        router.delete('leagues/venues/:id', [controllers.Venues, 'destroy'])

        router.post('leagues/:leagueId/stages', [controllers.Stages, 'store'])
        router.post('leagues/stages/:id/seed', [controllers.Stages, 'seed'])
        router.post('leagues/stages/:id/next-round', [controllers.Stages, 'nextRound'])
        router.post('leagues/stages/:id/groups/assign', [controllers.Stages, 'assignGroups'])
        router.post('leagues/stages/:id/fixtures', [controllers.Stages, 'generateFixtures'])
        router.get('leagues/stages/:id/qualifiers', [controllers.Stages, 'qualifiers'])
        router.post('leagues/stages/:id/generate-knockout', [
          controllers.Stages,
          'generateKnockout',
        ])

        router.get('leagues/stages/:id/standings/adjustments', [
          controllers.StandingAdjustments,
          'index',
        ])
        router.post('leagues/stages/:id/standings/adjustments', [
          controllers.StandingAdjustments,
          'store',
        ])
        router.put('leagues/stages/adjustments/:aid', [controllers.StandingAdjustments, 'update'])
        router.delete('leagues/stages/adjustments/:aid', [
          controllers.StandingAdjustments,
          'destroy',
        ])

        router.post('leagues/stages/:id/standings/overrides', [
          controllers.StandingOverrides,
          'store',
        ])
        router.delete('leagues/stages/:id/standings/overrides/:oid', [
          controllers.StandingOverrides,
          'destroy',
        ])

        router.get('leagues/stages/:id/zones', [controllers.StandingZones, 'index'])
        router.post('leagues/stages/:id/zones', [controllers.StandingZones, 'store'])
        router.put('leagues/stages/zones/:zid', [controllers.StandingZones, 'update'])
        router.delete('leagues/stages/zones/:zid', [controllers.StandingZones, 'destroy'])

        router.get('leagues/:leagueId/audit-logs', [controllers.AuditLogs, 'index'])

        router.post('leagues/assign-team', [controllers.Players, 'assignTeam'])

        router.get('invites/generate', [controllers.Invites, 'generate']).use(inviteThrottle)

        router.get('leagues/:leagueId/seasons/:seasonId/roster', [
          controllers.LeaguePlayers,
          'roster',
        ])
        router.put('leagues/league-players/:id', [controllers.LeaguePlayers, 'update'])
        router.delete('leagues/league-players/:id', [controllers.LeaguePlayers, 'destroy'])

        router.post('leagues/games', [controllers.Games, 'store'])
        router.put('leagues/games/:id', [controllers.Games, 'update'])
        router.delete('leagues/games/:id', [controllers.Games, 'destroy'])

        router.post('leagues/stats', [controllers.Stats, 'store'])
        router.post('leagues/stats/substitutions', [controllers.Stats, 'recordSubstitutions'])
        router.put('leagues/stats/:id', [controllers.Stats, 'update'])
        router.delete('leagues/stats/:id', [controllers.Stats, 'destroy'])
      })
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
  })
  .prefix('/api/v1')
  .use(globalThrottle)
