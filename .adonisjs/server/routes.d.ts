import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'users.forgot_password': { paramsTuple?: []; params?: {} }
    'users.reset_password': { paramsTuple?: []; params?: {} }
    'users.google_redirect': { paramsTuple?: []; params?: {} }
    'users.google_callback': { paramsTuple?: []; params?: {} }
    'users.logout': { paramsTuple?: []; params?: {} }
    'auth_users.me': { paramsTuple?: []; params?: {} }
    'auth_users.leagues': { paramsTuple?: []; params?: {} }
    'auth_users.teams': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'auth_users.search': { paramsTuple?: []; params?: {} }
    'countries.index': { paramsTuple?: []; params?: {} }
    'countries.show': { paramsTuple: [ParamValue]; params: {'idOrCode': ParamValue} }
    'leagues.index': { paramsTuple?: []; params?: {} }
    'leagues.show': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'leagues.store': { paramsTuple?: []; params?: {} }
    'searches.search': { paramsTuple?: []; params?: {} }
    'games.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teams.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invites.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invites.complete_profile_and_accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.accept_league_player_request': { paramsTuple?: []; params?: {} }
    'players.league_player_requests': { paramsTuple?: []; params?: {} }
    'favourite_leagues.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'favourite_leagues.destroy': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'game_score.update': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_score.accredit': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'statId': ParamValue} }
    'game_time.start_first_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_half_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_second_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_extra_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.pause': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.resume': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.end_game': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'leagues.update': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'seasons.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'teams.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'teams.update': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'id': ParamValue} }
    'players.assign_team': { paramsTuple?: []; params?: {} }
    'invites.generate': { paramsTuple?: []; params?: {} }
    'league_players.roster': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
    'league_players.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'league_players.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.store': { paramsTuple?: []; params?: {} }
    'games.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.store': { paramsTuple?: []; params?: {} }
    'stats.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'users.google_redirect': { paramsTuple?: []; params?: {} }
    'users.google_callback': { paramsTuple?: []; params?: {} }
    'auth_users.me': { paramsTuple?: []; params?: {} }
    'auth_users.leagues': { paramsTuple?: []; params?: {} }
    'auth_users.teams': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'auth_users.search': { paramsTuple?: []; params?: {} }
    'countries.index': { paramsTuple?: []; params?: {} }
    'countries.show': { paramsTuple: [ParamValue]; params: {'idOrCode': ParamValue} }
    'leagues.index': { paramsTuple?: []; params?: {} }
    'leagues.show': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'searches.search': { paramsTuple?: []; params?: {} }
    'games.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teams.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invites.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.league_player_requests': { paramsTuple?: []; params?: {} }
    'invites.generate': { paramsTuple?: []; params?: {} }
    'league_players.roster': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'users.google_redirect': { paramsTuple?: []; params?: {} }
    'users.google_callback': { paramsTuple?: []; params?: {} }
    'auth_users.me': { paramsTuple?: []; params?: {} }
    'auth_users.leagues': { paramsTuple?: []; params?: {} }
    'auth_users.teams': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'auth_users.search': { paramsTuple?: []; params?: {} }
    'countries.index': { paramsTuple?: []; params?: {} }
    'countries.show': { paramsTuple: [ParamValue]; params: {'idOrCode': ParamValue} }
    'leagues.index': { paramsTuple?: []; params?: {} }
    'leagues.show': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'searches.search': { paramsTuple?: []; params?: {} }
    'games.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teams.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invites.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.league_player_requests': { paramsTuple?: []; params?: {} }
    'invites.generate': { paramsTuple?: []; params?: {} }
    'league_players.roster': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'users.signup': { paramsTuple?: []; params?: {} }
    'users.login': { paramsTuple?: []; params?: {} }
    'users.forgot_password': { paramsTuple?: []; params?: {} }
    'users.reset_password': { paramsTuple?: []; params?: {} }
    'users.logout': { paramsTuple?: []; params?: {} }
    'leagues.store': { paramsTuple?: []; params?: {} }
    'invites.complete_profile_and_accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.accept_league_player_request': { paramsTuple?: []; params?: {} }
    'favourite_leagues.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'game_score.update': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_first_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_half_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_second_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_extra_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.pause': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.resume': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.end_game': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'seasons.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'teams.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'players.assign_team': { paramsTuple?: []; params?: {} }
    'games.store': { paramsTuple?: []; params?: {} }
    'stats.store': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'favourite_leagues.destroy': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'league_players.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'game_score.accredit': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'statId': ParamValue} }
  }
  PUT: {
    'leagues.update': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'teams.update': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'id': ParamValue} }
    'league_players.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}