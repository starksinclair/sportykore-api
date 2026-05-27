/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'drive.fs.serve': {
    methods: ["GET","HEAD"]
    pattern: '/uploads/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'new_account.create': {
    methods: ["GET","HEAD"]
    pattern: '/signup'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
    }
  }
  'new_account.store': {
    methods: ["POST"]
    pattern: '/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'users.signup': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['signup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['signup']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.login': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.forgot_password': {
    methods: ["POST"]
    pattern: '/api/v1/auth/forgot-password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['forgotPassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['forgotPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.reset_password': {
    methods: ["POST"]
    pattern: '/api/v1/auth/reset-password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').resetPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').resetPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['resetPassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['resetPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.google_redirect': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/google/redirect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['googleRedirect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['googleRedirect']>>>
    }
  }
  'users.google_callback': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/google/callback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['googleCallback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['googleCallback']>>>
    }
  }
  'users.logout': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['logout']>>>
    }
  }
  'auth_users.me': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/users/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['me']>>>
    }
  }
  'auth_users.leagues': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/users/leagues'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['leagues']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['leagues']>>>
    }
  }
  'auth_users.teams': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/users/leagues/:leagueId/teams'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['teams']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['teams']>>>
    }
  }
  'auth_users.search': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/users/search'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['search']>>>
    }
  }
  'countries.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/countries'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/countries_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/countries_controller').default['index']>>>
    }
  }
  'countries.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/countries/:idOrCode'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { idOrCode: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/countries_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/countries_controller').default['show']>>>
    }
  }
  'leagues.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leagues'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['index']>>>
    }
  }
  'leagues.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leagues/:leagueId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['show']>>>
    }
  }
  'leagues.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/league').createLeagueWithSeasonValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/league').createLeagueWithSeasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'searches.search': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/search'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/searches_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/searches_controller').default['search']>>>
    }
  }
  'games.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/games/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/games_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/games_controller').default['show']>>>
    }
  }
  'teams.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/teams/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['show']>>>
    }
  }
  'players.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/players/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/players_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/players_controller').default['show']>>>
    }
  }
  'invites.accept': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/invites/accept/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['accept']>>>
    }
  }
  'invites.complete_profile_and_accept': {
    methods: ["POST"]
    pattern: '/api/v1/invites/complete-profile-and-accept/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['completeProfileAndAccept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['completeProfileAndAccept']>>>
    }
  }
  'players.accept_league_player_request': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/accept-league-player-request'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/league_player').acceptLeaguePlayerRequestValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/league_player').acceptLeaguePlayerRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/players_controller').default['acceptLeaguePlayerRequest']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/players_controller').default['acceptLeaguePlayerRequest']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'players.league_player_requests': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leagues/league-player-requests'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/players_controller').default['leaguePlayerRequests']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/players_controller').default['leaguePlayerRequests']>>>
    }
  }
  'favourite_leagues.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/:leagueId/favorite'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['store']>>>
    }
  }
  'favourite_leagues.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/:leagueId/favorite'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['destroy']>>>
    }
  }
  'leagues.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/:leagueId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/league').updateLeagueValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/league').updateLeagueValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/leagues_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'seasons.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/:leagueId/seasons'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/season').createSeasonValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/season').createSeasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'teams.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/:leagueId/teams'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/team').createTeamValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/team').createTeamValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'teams.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/:leagueId/teams/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/team').updateTeamValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { leagueId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/team').updateTeamValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'players.assign_team': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/assign-team'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/league_player').createLeaguePlayerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/league_player').createLeaguePlayerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/players_controller').default['assignTeam']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/players_controller').default['assignTeam']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invites.generate': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/invites/generate'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/invite').generateInviteValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['generate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['generate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'league_players.roster': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leagues/:leagueId/seasons/:seasonId/roster'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { leagueId: ParamValue; seasonId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/league_players_controller').default['roster']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/league_players_controller').default['roster']>>>
    }
  }
  'league_players.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/league-players/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/league_player').updateLeaguePlayerValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/league_player').updateLeaguePlayerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/league_players_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/league_players_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'league_players.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/league-players/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/league_players_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/league_players_controller').default['destroy']>>>
    }
  }
  'games.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/games'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').createGameValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/game').createGameValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/games_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/games_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'games.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/games/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').updateGameValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').updateGameValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/games_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/games_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'games.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/games/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/games_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/games_controller').default['destroy']>>>
    }
  }
  'stats.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/stats'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stat').createStatValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stat').createStatValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stats.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/stats/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stat').updateStatValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stat').updateStatValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stats.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/stats/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['destroy']>>>
    }
  }
}
