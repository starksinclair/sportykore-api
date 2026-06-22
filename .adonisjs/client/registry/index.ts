/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'drive.fs.serve': {
    methods: ["GET","HEAD"],
    pattern: '/uploads/*',
    tokens: [{"old":"/uploads/*","type":0,"val":"uploads","end":""},{"old":"/uploads/*","type":2,"val":"*","end":""}],
    types: placeholder as Registry['drive.fs.serve']['types'],
  },
  'event_stream': {
    methods: ["GET","HEAD"],
    pattern: '/__transmit/events',
    tokens: [{"old":"/__transmit/events","type":0,"val":"__transmit","end":""},{"old":"/__transmit/events","type":0,"val":"events","end":""}],
    types: placeholder as Registry['event_stream']['types'],
  },
  'subscribe': {
    methods: ["POST"],
    pattern: '/__transmit/subscribe',
    tokens: [{"old":"/__transmit/subscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/subscribe","type":0,"val":"subscribe","end":""}],
    types: placeholder as Registry['subscribe']['types'],
  },
  'unsubscribe': {
    methods: ["POST"],
    pattern: '/__transmit/unsubscribe',
    tokens: [{"old":"/__transmit/unsubscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/unsubscribe","type":0,"val":"unsubscribe","end":""}],
    types: placeholder as Registry['unsubscribe']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'auth.request_otp': {
    methods: ["POST"],
    pattern: '/api/v1/auth/request-otp',
    tokens: [{"old":"/api/v1/auth/request-otp","type":0,"val":"api","end":""},{"old":"/api/v1/auth/request-otp","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/request-otp","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/request-otp","type":0,"val":"request-otp","end":""}],
    types: placeholder as Registry['auth.request_otp']['types'],
  },
  'auth.verify_otp': {
    methods: ["POST"],
    pattern: '/api/v1/auth/verify-otp',
    tokens: [{"old":"/api/v1/auth/verify-otp","type":0,"val":"api","end":""},{"old":"/api/v1/auth/verify-otp","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/verify-otp","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/verify-otp","type":0,"val":"verify-otp","end":""}],
    types: placeholder as Registry['auth.verify_otp']['types'],
  },
  'auth.request_recovery': {
    methods: ["POST"],
    pattern: '/api/v1/auth/recover',
    tokens: [{"old":"/api/v1/auth/recover","type":0,"val":"api","end":""},{"old":"/api/v1/auth/recover","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/recover","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/recover","type":0,"val":"recover","end":""}],
    types: placeholder as Registry['auth.request_recovery']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [{"old":"/api/v1/auth/logout","type":0,"val":"api","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'auth.delete_account': {
    methods: ["DELETE"],
    pattern: '/api/v1/auth/account',
    tokens: [{"old":"/api/v1/auth/account","type":0,"val":"api","end":""},{"old":"/api/v1/auth/account","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/account","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/account","type":0,"val":"account","end":""}],
    types: placeholder as Registry['auth.delete_account']['types'],
  },
  'auth_users.me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/users/me',
    tokens: [{"old":"/api/v1/auth/users/me","type":0,"val":"api","end":""},{"old":"/api/v1/auth/users/me","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/users/me","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/users/me","type":0,"val":"users","end":""},{"old":"/api/v1/auth/users/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['auth_users.me']['types'],
  },
  'auth_users.leagues': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/users/leagues',
    tokens: [{"old":"/api/v1/auth/users/leagues","type":0,"val":"api","end":""},{"old":"/api/v1/auth/users/leagues","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/users/leagues","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/users/leagues","type":0,"val":"users","end":""},{"old":"/api/v1/auth/users/leagues","type":0,"val":"leagues","end":""}],
    types: placeholder as Registry['auth_users.leagues']['types'],
  },
  'auth_users.teams': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/users/leagues/:leagueId/teams',
    tokens: [{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":0,"val":"api","end":""},{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":0,"val":"users","end":""},{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":0,"val":"leagues","end":""},{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":1,"val":"leagueId","end":""},{"old":"/api/v1/auth/users/leagues/:leagueId/teams","type":0,"val":"teams","end":""}],
    types: placeholder as Registry['auth_users.teams']['types'],
  },
  'auth_users.search': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/users/search',
    tokens: [{"old":"/api/v1/auth/users/search","type":0,"val":"api","end":""},{"old":"/api/v1/auth/users/search","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/users/search","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/users/search","type":0,"val":"users","end":""},{"old":"/api/v1/auth/users/search","type":0,"val":"search","end":""}],
    types: placeholder as Registry['auth_users.search']['types'],
  },
  'countries.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/countries',
    tokens: [{"old":"/api/v1/countries","type":0,"val":"api","end":""},{"old":"/api/v1/countries","type":0,"val":"v1","end":""},{"old":"/api/v1/countries","type":0,"val":"countries","end":""}],
    types: placeholder as Registry['countries.index']['types'],
  },
  'countries.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/countries/:idOrCode',
    tokens: [{"old":"/api/v1/countries/:idOrCode","type":0,"val":"api","end":""},{"old":"/api/v1/countries/:idOrCode","type":0,"val":"v1","end":""},{"old":"/api/v1/countries/:idOrCode","type":0,"val":"countries","end":""},{"old":"/api/v1/countries/:idOrCode","type":1,"val":"idOrCode","end":""}],
    types: placeholder as Registry['countries.show']['types'],
  },
  'leagues.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/leagues',
    tokens: [{"old":"/api/v1/leagues","type":0,"val":"api","end":""},{"old":"/api/v1/leagues","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues","type":0,"val":"leagues","end":""}],
    types: placeholder as Registry['leagues.index']['types'],
  },
  'leagues.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/leagues/:leagueId',
    tokens: [{"old":"/api/v1/leagues/:leagueId","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId","type":1,"val":"leagueId","end":""}],
    types: placeholder as Registry['leagues.show']['types'],
  },
  'leagues.store': {
    methods: ["POST"],
    pattern: '/api/v1/leagues',
    tokens: [{"old":"/api/v1/leagues","type":0,"val":"api","end":""},{"old":"/api/v1/leagues","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues","type":0,"val":"leagues","end":""}],
    types: placeholder as Registry['leagues.store']['types'],
  },
  'searches.search': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/search',
    tokens: [{"old":"/api/v1/search","type":0,"val":"api","end":""},{"old":"/api/v1/search","type":0,"val":"v1","end":""},{"old":"/api/v1/search","type":0,"val":"search","end":""}],
    types: placeholder as Registry['searches.search']['types'],
  },
  'games.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/games/:id',
    tokens: [{"old":"/api/v1/games/:id","type":0,"val":"api","end":""},{"old":"/api/v1/games/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:id","type":0,"val":"games","end":""},{"old":"/api/v1/games/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['games.show']['types'],
  },
  'teams.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/teams/:id',
    tokens: [{"old":"/api/v1/teams/:id","type":0,"val":"api","end":""},{"old":"/api/v1/teams/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/teams/:id","type":0,"val":"teams","end":""},{"old":"/api/v1/teams/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['teams.show']['types'],
  },
  'players.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/players/:id',
    tokens: [{"old":"/api/v1/players/:id","type":0,"val":"api","end":""},{"old":"/api/v1/players/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/players/:id","type":0,"val":"players","end":""},{"old":"/api/v1/players/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['players.show']['types'],
  },
  'invites.accept': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/invites/accept/:token',
    tokens: [{"old":"/api/v1/invites/accept/:token","type":0,"val":"api","end":""},{"old":"/api/v1/invites/accept/:token","type":0,"val":"v1","end":""},{"old":"/api/v1/invites/accept/:token","type":0,"val":"invites","end":""},{"old":"/api/v1/invites/accept/:token","type":0,"val":"accept","end":""},{"old":"/api/v1/invites/accept/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['invites.accept']['types'],
  },
  'invites.complete_profile_and_accept': {
    methods: ["POST"],
    pattern: '/api/v1/invites/complete-profile-and-accept/:token',
    tokens: [{"old":"/api/v1/invites/complete-profile-and-accept/:token","type":0,"val":"api","end":""},{"old":"/api/v1/invites/complete-profile-and-accept/:token","type":0,"val":"v1","end":""},{"old":"/api/v1/invites/complete-profile-and-accept/:token","type":0,"val":"invites","end":""},{"old":"/api/v1/invites/complete-profile-and-accept/:token","type":0,"val":"complete-profile-and-accept","end":""},{"old":"/api/v1/invites/complete-profile-and-accept/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['invites.complete_profile_and_accept']['types'],
  },
  'players.accept_league_player_request': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/accept-league-player-request',
    tokens: [{"old":"/api/v1/leagues/accept-league-player-request","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/accept-league-player-request","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/accept-league-player-request","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/accept-league-player-request","type":0,"val":"accept-league-player-request","end":""}],
    types: placeholder as Registry['players.accept_league_player_request']['types'],
  },
  'players.league_player_requests': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/leagues/league-player-requests',
    tokens: [{"old":"/api/v1/leagues/league-player-requests","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/league-player-requests","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/league-player-requests","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/league-player-requests","type":0,"val":"league-player-requests","end":""}],
    types: placeholder as Registry['players.league_player_requests']['types'],
  },
  'favourite_leagues.store': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/:leagueId/favorite',
    tokens: [{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":1,"val":"leagueId","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"favorite","end":""}],
    types: placeholder as Registry['favourite_leagues.store']['types'],
  },
  'favourite_leagues.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/leagues/:leagueId/favorite',
    tokens: [{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":1,"val":"leagueId","end":""},{"old":"/api/v1/leagues/:leagueId/favorite","type":0,"val":"favorite","end":""}],
    types: placeholder as Registry['favourite_leagues.destroy']['types'],
  },
  'game_score.update': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/score',
    tokens: [{"old":"/api/v1/games/:gameId/score","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/score","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/score","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/score","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/score","type":0,"val":"score","end":""}],
    types: placeholder as Registry['game_score.update']['types'],
  },
  'game_score.accredit': {
    methods: ["PATCH"],
    pattern: '/api/v1/games/:gameId/stats/:statId/accredit',
    tokens: [{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":0,"val":"stats","end":""},{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":1,"val":"statId","end":""},{"old":"/api/v1/games/:gameId/stats/:statId/accredit","type":0,"val":"accredit","end":""}],
    types: placeholder as Registry['game_score.accredit']['types'],
  },
  'game_time.start_first_half': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/start-first-half',
    tokens: [{"old":"/api/v1/games/:gameId/start-first-half","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/start-first-half","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/start-first-half","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/start-first-half","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/start-first-half","type":0,"val":"start-first-half","end":""}],
    types: placeholder as Registry['game_time.start_first_half']['types'],
  },
  'game_time.start_half_time': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/half-time',
    tokens: [{"old":"/api/v1/games/:gameId/half-time","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/half-time","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/half-time","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/half-time","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/half-time","type":0,"val":"half-time","end":""}],
    types: placeholder as Registry['game_time.start_half_time']['types'],
  },
  'game_time.start_second_half': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/start-second-half',
    tokens: [{"old":"/api/v1/games/:gameId/start-second-half","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/start-second-half","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/start-second-half","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/start-second-half","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/start-second-half","type":0,"val":"start-second-half","end":""}],
    types: placeholder as Registry['game_time.start_second_half']['types'],
  },
  'game_time.start_extra_time': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/extra-time',
    tokens: [{"old":"/api/v1/games/:gameId/extra-time","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/extra-time","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/extra-time","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/extra-time","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/extra-time","type":0,"val":"extra-time","end":""}],
    types: placeholder as Registry['game_time.start_extra_time']['types'],
  },
  'game_time.pause': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/pause',
    tokens: [{"old":"/api/v1/games/:gameId/pause","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/pause","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/pause","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/pause","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/pause","type":0,"val":"pause","end":""}],
    types: placeholder as Registry['game_time.pause']['types'],
  },
  'game_time.resume': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/resume',
    tokens: [{"old":"/api/v1/games/:gameId/resume","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/resume","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/resume","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/resume","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/resume","type":0,"val":"resume","end":""}],
    types: placeholder as Registry['game_time.resume']['types'],
  },
  'game_time.end_game': {
    methods: ["POST"],
    pattern: '/api/v1/games/:gameId/full-time',
    tokens: [{"old":"/api/v1/games/:gameId/full-time","type":0,"val":"api","end":""},{"old":"/api/v1/games/:gameId/full-time","type":0,"val":"v1","end":""},{"old":"/api/v1/games/:gameId/full-time","type":0,"val":"games","end":""},{"old":"/api/v1/games/:gameId/full-time","type":1,"val":"gameId","end":""},{"old":"/api/v1/games/:gameId/full-time","type":0,"val":"full-time","end":""}],
    types: placeholder as Registry['game_time.end_game']['types'],
  },
  'leagues.update': {
    methods: ["PUT"],
    pattern: '/api/v1/leagues/:leagueId',
    tokens: [{"old":"/api/v1/leagues/:leagueId","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId","type":1,"val":"leagueId","end":""}],
    types: placeholder as Registry['leagues.update']['types'],
  },
  'seasons.store': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/:leagueId/seasons',
    tokens: [{"old":"/api/v1/leagues/:leagueId/seasons","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId/seasons","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId/seasons","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId/seasons","type":1,"val":"leagueId","end":""},{"old":"/api/v1/leagues/:leagueId/seasons","type":0,"val":"seasons","end":""}],
    types: placeholder as Registry['seasons.store']['types'],
  },
  'teams.store': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/:leagueId/teams',
    tokens: [{"old":"/api/v1/leagues/:leagueId/teams","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId/teams","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId/teams","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId/teams","type":1,"val":"leagueId","end":""},{"old":"/api/v1/leagues/:leagueId/teams","type":0,"val":"teams","end":""}],
    types: placeholder as Registry['teams.store']['types'],
  },
  'teams.update': {
    methods: ["PUT"],
    pattern: '/api/v1/leagues/:leagueId/teams/:id',
    tokens: [{"old":"/api/v1/leagues/:leagueId/teams/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId/teams/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId/teams/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId/teams/:id","type":1,"val":"leagueId","end":""},{"old":"/api/v1/leagues/:leagueId/teams/:id","type":0,"val":"teams","end":""},{"old":"/api/v1/leagues/:leagueId/teams/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['teams.update']['types'],
  },
  'players.assign_team': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/assign-team',
    tokens: [{"old":"/api/v1/leagues/assign-team","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/assign-team","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/assign-team","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/assign-team","type":0,"val":"assign-team","end":""}],
    types: placeholder as Registry['players.assign_team']['types'],
  },
  'invites.generate': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/invites/generate',
    tokens: [{"old":"/api/v1/invites/generate","type":0,"val":"api","end":""},{"old":"/api/v1/invites/generate","type":0,"val":"v1","end":""},{"old":"/api/v1/invites/generate","type":0,"val":"invites","end":""},{"old":"/api/v1/invites/generate","type":0,"val":"generate","end":""}],
    types: placeholder as Registry['invites.generate']['types'],
  },
  'league_players.roster': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/leagues/:leagueId/seasons/:seasonId/roster',
    tokens: [{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":1,"val":"leagueId","end":""},{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":0,"val":"seasons","end":""},{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":1,"val":"seasonId","end":""},{"old":"/api/v1/leagues/:leagueId/seasons/:seasonId/roster","type":0,"val":"roster","end":""}],
    types: placeholder as Registry['league_players.roster']['types'],
  },
  'league_players.update': {
    methods: ["PUT"],
    pattern: '/api/v1/leagues/league-players/:id',
    tokens: [{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"league-players","end":""},{"old":"/api/v1/leagues/league-players/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['league_players.update']['types'],
  },
  'league_players.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/leagues/league-players/:id',
    tokens: [{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/league-players/:id","type":0,"val":"league-players","end":""},{"old":"/api/v1/leagues/league-players/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['league_players.destroy']['types'],
  },
  'games.store': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/games',
    tokens: [{"old":"/api/v1/leagues/games","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/games","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/games","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/games","type":0,"val":"games","end":""}],
    types: placeholder as Registry['games.store']['types'],
  },
  'games.update': {
    methods: ["PUT"],
    pattern: '/api/v1/leagues/games/:id',
    tokens: [{"old":"/api/v1/leagues/games/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/games/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/games/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/games/:id","type":0,"val":"games","end":""},{"old":"/api/v1/leagues/games/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['games.update']['types'],
  },
  'games.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/leagues/games/:id',
    tokens: [{"old":"/api/v1/leagues/games/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/games/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/games/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/games/:id","type":0,"val":"games","end":""},{"old":"/api/v1/leagues/games/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['games.destroy']['types'],
  },
  'stats.store': {
    methods: ["POST"],
    pattern: '/api/v1/leagues/stats',
    tokens: [{"old":"/api/v1/leagues/stats","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/stats","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/stats","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/stats","type":0,"val":"stats","end":""}],
    types: placeholder as Registry['stats.store']['types'],
  },
  'stats.update': {
    methods: ["PUT"],
    pattern: '/api/v1/leagues/stats/:id',
    tokens: [{"old":"/api/v1/leagues/stats/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/stats/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/stats/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/stats/:id","type":0,"val":"stats","end":""},{"old":"/api/v1/leagues/stats/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['stats.update']['types'],
  },
  'stats.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/leagues/stats/:id',
    tokens: [{"old":"/api/v1/leagues/stats/:id","type":0,"val":"api","end":""},{"old":"/api/v1/leagues/stats/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/leagues/stats/:id","type":0,"val":"leagues","end":""},{"old":"/api/v1/leagues/stats/:id","type":0,"val":"stats","end":""},{"old":"/api/v1/leagues/stats/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['stats.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
