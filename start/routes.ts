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
 * Mobile / JSON API authentication (Bearer access tokens + Google via Ally).
 */
router
  .group(() => {
    router.post('signup', [controllers.Users, 'signup'])
    router.post('login', [controllers.Users, 'login'])
    router.post('forgot-password', [controllers.Users, 'forgotPassword'])
    router.post('reset-password', [controllers.Users, 'resetPassword'])
    router.get('google/redirect', [controllers.Users, 'googleRedirect'])
    router.get('google/callback', [controllers.Users, 'googleCallback'])
    router.post('logout', [controllers.Users, 'logout']).use(middleware.apiAuth())

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
    router.get('search', [controllers.Searches, 'search'])
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
        router.put('leagues/:leagueId', [controllers.Leagues, 'update'])

        router.post('leagues/:leagueId/seasons', [controllers.Seasons, 'store'])

        router.post('leagues/:leagueId/teams', [controllers.Teams, 'store'])
        router.put('leagues/:leagueId/teams/:id', [controllers.Teams, 'update'])

        router.post('leagues/assign-team', [controllers.Players, 'assignTeam'])

        router.get('invites/generate', [controllers.Invites, 'generate'])

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
