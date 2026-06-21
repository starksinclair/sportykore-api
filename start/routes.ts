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
  gameUpdateThrottle,
  globalThrottle,
  inviteThrottle,
  otpRequestThrottle,
  otpVerifyThrottle,
  searchThrottle,
} from '#start/limiter'

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
    // Deprecated — email/password + Google OAuth (see ROUTES.md)
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
    router
      .delete('account', [controllers.Auth, 'deleteAccount'])
      .use(middleware.apiAuth())

    router
      .group(() => {
        router.get('me', [controllers.AuthUsers, 'me'])
        router.get('leagues', [controllers.AuthUsers, 'leagues'])
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
    router.get('games/:id', [controllers.Games, 'show'])
    router.get('teams/:id', [controllers.Teams, 'show'])
    router.get('players/:id', [controllers.Players, 'show'])
    router.get('invites/accept/:token', [controllers.Invites, 'accept'])
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
      .group(() => {
        router.post('games/:gameId/score', [controllers.GameScore, 'update'])
        router.patch('games/:gameId/stats/:statId/accredit', [controllers.GameScore, 'accredit'])
        router.post('games/:gameId/start-first-half', [controllers.GameTime, 'startFirstHalf'])
        router.post('games/:gameId/half-time', [controllers.GameTime, 'startHalfTime'])
        router.post('games/:gameId/start-second-half', [controllers.GameTime, 'startSecondHalf'])
        router.post('games/:gameId/extra-time', [controllers.GameTime, 'startExtraTime'])
        router.post('games/:gameId/pause', [controllers.GameTime, 'pause'])
        router.post('games/:gameId/resume', [controllers.GameTime, 'resume'])
        router.post('games/:gameId/full-time', [controllers.GameTime, 'endGame'])
      })
      .use(middleware.apiAuth())
      .use(middleware.teamOwner())
      .use(gameUpdateThrottle)

    router
      .group(() => {
        router.put('leagues/:leagueId', [controllers.Leagues, 'update'])

        router.post('leagues/:leagueId/seasons', [controllers.Seasons, 'store'])

        router.post('leagues/:leagueId/teams', [controllers.Teams, 'store'])
        router.put('leagues/:leagueId/teams/:id', [controllers.Teams, 'update'])

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
        router.put('leagues/stats/:id', [controllers.Stats, 'update'])
        router.delete('leagues/stats/:id', [controllers.Stats, 'destroy'])
      })
      .use(middleware.apiAuth())
      .use(middleware.leagueOwner())
  })
  .prefix('/api/v1')
  .use(globalThrottle)
