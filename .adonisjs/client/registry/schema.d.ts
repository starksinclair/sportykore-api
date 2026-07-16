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
  'event_stream': {
    methods: ["GET","HEAD"]
    pattern: '/__transmit/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'subscribe': {
    methods: ["POST"]
    pattern: '/__transmit/subscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'unsubscribe': {
    methods: ["POST"]
    pattern: '/__transmit/unsubscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
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
  'auth.request_otp': {
    methods: ["POST"]
    pattern: '/api/v1/auth/request-otp'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').requestOtpValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').requestOtpValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['requestOtp']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['requestOtp']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.verify_otp': {
    methods: ["POST"]
    pattern: '/api/v1/auth/verify-otp'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').verifyOtpValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').verifyOtpValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['verifyOtp']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['verifyOtp']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.request_recovery': {
    methods: ["POST"]
    pattern: '/api/v1/auth/recover'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth').requestRecoveryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth').requestRecoveryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['requestRecovery']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['requestRecovery']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
    }
  }
  'auth.delete_account': {
    methods: ["DELETE"]
    pattern: '/api/v1/auth/account'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['deleteAccount']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['deleteAccount']>>>
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
  'auth_users.managed': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/users/managed'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['managed']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_users_controller').default['managed']>>>
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
  'formations.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/formations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/formations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/formations_controller').default['index']>>>
    }
  }
  'formations.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/formations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/formations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/formations_controller').default['show']>>>
    }
  }
  'game_lineups.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/games/:gameId/lineups'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['index']>>>
    }
  }
  'stages.bracket': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leagues/stages/:id/bracket'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['bracket']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['bracket']>>>
    }
  }
  'stages.index_by_season': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/seasons/:seasonId/stages'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { seasonId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['indexBySeason']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['indexBySeason']>>>
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
  'players.does_user_have_player_profile': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/players/does-user-have-player-profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/players_controller').default['doesUserHavePlayerProfile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/players_controller').default['doesUserHavePlayerProfile']>>>
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
      body: ExtractBody<InferInput<(typeof import('#validators/invite').completeProfileAndAcceptValidator)>>
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/invite').completeProfileAndAcceptValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['completeProfileAndAccept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invites_controller').default['completeProfileAndAccept']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/favourite_league').favouriteLeagueParamsValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/favourite_league').favouriteLeagueParamsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'favourite_leagues.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/:leagueId/favorite'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/favourite_league').favouriteLeagueParamsValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/favourite_league').favouriteLeagueParamsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/favourite_leagues_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_score.update': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/score'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game_score').updateGameScoreValidator)>>
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game_score').updateGameScoreValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_score_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_score_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_score.accredit': {
    methods: ["PATCH"]
    pattern: '/api/v1/games/:gameId/stats/:statId/accredit'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game_score').accreditStatValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { gameId: ParamValue; statId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game_score').accreditStatValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_score_controller').default['accredit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_score_controller').default['accredit']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_time.start_first_half': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/start-first-half'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startFirstHalf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startFirstHalf']>>>
    }
  }
  'game_time.start_half_time': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/half-time'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startHalfTime']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startHalfTime']>>>
    }
  }
  'game_time.start_second_half': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/start-second-half'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startSecondHalf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startSecondHalf']>>>
    }
  }
  'game_time.start_extra_time': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/extra-time'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startExtraTime']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startExtraTime']>>>
    }
  }
  'game_time.pause': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/pause'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['pause']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['pause']>>>
    }
  }
  'game_time.resume': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/resume'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['resume']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['resume']>>>
    }
  }
  'game_time.end_game': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/full-time'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game_time').endGameValidator)>>
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game_time').endGameValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['endGame']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['endGame']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_time.start_penalty_shootout': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/penalty-shootout'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startPenaltyShootout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['startPenaltyShootout']>>>
    }
  }
  'game_time.complete_penalty_shootout': {
    methods: ["POST"]
    pattern: '/api/v1/games/:gameId/penalty-shootout/complete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stage').completePenaltyShootoutValidator)>>
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stage').completePenaltyShootoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['completePenaltyShootout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_time_controller').default['completePenaltyShootout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_lineups.set': {
    methods: ["PUT"]
    pattern: '/api/v1/games/:gameId/lineups'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/lineup').setLineupValidator)>>
      paramsTuple: [ParamValue]
      params: { gameId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/lineup').setLineupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['set']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['set']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_lineups.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/games/:gameId/lineups/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/lineup').updateLineupValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { gameId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/lineup').updateLineupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game_lineups.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/games/:gameId/lineups/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { gameId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game_lineups_controller').default['destroy']>>>
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
  'seasons.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/:leagueId/seasons/:seasonId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/season').updateSeasonValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { leagueId: ParamValue; seasonId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/season').updateSeasonValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/seasons_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'teams.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/:leagueId/teams/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { leagueId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teams_controller').default['destroy']>>>
    }
  }
  'team_admins.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/:leagueId/teams/:teamId/admins'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/team_admin').assignTeamAdminValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { leagueId: ParamValue; teamId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/team_admin').assignTeamAdminValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/team_admins_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/team_admins_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'team_admins.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/:leagueId/teams/:teamId/admins/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue, ParamValue]
      params: { leagueId: ParamValue; teamId: ParamValue; userId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/team_admins_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/team_admins_controller').default['destroy']>>>
    }
  }
  'venues.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leagues/:leagueId/venues'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['index']>>>
    }
  }
  'venues.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/:leagueId/venues'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/venue').createVenueValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/venue').createVenueValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'venues.update': {
    methods: ["PUT"]
    pattern: '/api/v1/leagues/venues/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/venue').updateVenueValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/venue').updateVenueValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'venues.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/leagues/venues/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/venues_controller').default['destroy']>>>
    }
  }
  'stages.store': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/:leagueId/stages'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stage').createKnockoutStageValidator)>>
      paramsTuple: [ParamValue]
      params: { leagueId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stage').createKnockoutStageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stages.seed': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/stages/:id/seed'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stage').seedKnockoutStageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stage').seedKnockoutStageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['seed']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['seed']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stages.next_round': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/stages/:id/next-round'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stage').nextRoundValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stage').nextRoundValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['nextRound']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stages_controller').default['nextRound']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'stats.record_substitutions': {
    methods: ["POST"]
    pattern: '/api/v1/leagues/stats/substitutions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stat').recordSubstitutionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stat').recordSubstitutionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['recordSubstitutions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stats_controller').default['recordSubstitutions']>>> | { status: 422; response: { errors: SimpleError[] } }
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
