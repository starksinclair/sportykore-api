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
    'auth.request_otp': { paramsTuple?: []; params?: {} }
    'auth.verify_otp': { paramsTuple?: []; params?: {} }
    'auth.request_recovery': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.delete_account': { paramsTuple?: []; params?: {} }
    'auth_users.me': { paramsTuple?: []; params?: {} }
    'auth_users.managed': { paramsTuple?: []; params?: {} }
    'auth_users.teams': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'auth_users.search': { paramsTuple?: []; params?: {} }
    'countries.index': { paramsTuple?: []; params?: {} }
    'countries.show': { paramsTuple: [ParamValue]; params: {'idOrCode': ParamValue} }
    'leagues.index': { paramsTuple?: []; params?: {} }
    'leagues.show': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'leagues.store': { paramsTuple?: []; params?: {} }
    'searches.search': { paramsTuple?: []; params?: {} }
    'support.faqs': { paramsTuple?: []; params?: {} }
    'support.bug_report': { paramsTuple?: []; params?: {} }
    'support.seed_faqs': { paramsTuple?: []; params?: {} }
    'games.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'formations.index': { paramsTuple?: []; params?: {} }
    'formations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game_lineups.index': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'stages.bracket': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.standings': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.index_by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'teams.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.does_user_have_player_profile': { paramsTuple?: []; params?: {} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me_player.show': { paramsTuple?: []; params?: {} }
    'me_player.store': { paramsTuple?: []; params?: {} }
    'me_player.update': { paramsTuple?: []; params?: {} }
    'me_player.photo': { paramsTuple?: []; params?: {} }
    'player_highlights.index': { paramsTuple?: []; params?: {} }
    'player_highlights.store': { paramsTuple?: []; params?: {} }
    'player_highlights.reorder': { paramsTuple?: []; params?: {} }
    'player_highlights.update': { paramsTuple: [ParamValue]; params: {'hid': ParamValue} }
    'player_highlights.destroy': { paramsTuple: [ParamValue]; params: {'hid': ParamValue} }
    'invites.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invites.complete_profile_and_accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.accept_league_player_request': { paramsTuple?: []; params?: {} }
    'players.league_player_requests': { paramsTuple?: []; params?: {} }
    'favourite_leagues.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'favourite_leagues.destroy': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'game_score.update': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_score.accredit': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'statId': ParamValue} }
    'player_awards.set_motm': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'stats.record_tracking_events': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_first_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_half_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_second_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_extra_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.pause': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.resume': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.end_game': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_penalty_shootout': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.complete_penalty_shootout': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_lineups.set': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_lineups.update': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'id': ParamValue} }
    'game_lineups.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'id': ParamValue} }
    'leagues.update': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'seasons.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'seasons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
    'teams.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'teams.update': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'id': ParamValue} }
    'teams.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'id': ParamValue} }
    'team_admins.store': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'teamId': ParamValue} }
    'team_admins.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'leagueId': ParamValue,'teamId': ParamValue,'userId': ParamValue} }
    'venues.index': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'venues.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'venues.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'venues.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'stages.seed': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.next_round': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.assign_groups': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.generate_fixtures': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.qualifiers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.generate_knockout': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.update': { paramsTuple: [ParamValue]; params: {'aid': ParamValue} }
    'standing_adjustments.destroy': { paramsTuple: [ParamValue]; params: {'aid': ParamValue} }
    'standing_overrides.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_overrides.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'oid': ParamValue} }
    'standing_zones.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_zones.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_zones.update': { paramsTuple: [ParamValue]; params: {'zid': ParamValue} }
    'standing_zones.destroy': { paramsTuple: [ParamValue]; params: {'zid': ParamValue} }
    'audit_logs.index': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'players.assign_team': { paramsTuple?: []; params?: {} }
    'invites.generate': { paramsTuple?: []; params?: {} }
    'league_players.roster': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
    'league_players.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'league_players.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.store': { paramsTuple?: []; params?: {} }
    'games.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.store': { paramsTuple?: []; params?: {} }
    'stats.record_substitutions': { paramsTuple?: []; params?: {} }
    'stats.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'auth_users.me': { paramsTuple?: []; params?: {} }
    'auth_users.managed': { paramsTuple?: []; params?: {} }
    'auth_users.teams': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'auth_users.search': { paramsTuple?: []; params?: {} }
    'countries.index': { paramsTuple?: []; params?: {} }
    'countries.show': { paramsTuple: [ParamValue]; params: {'idOrCode': ParamValue} }
    'leagues.index': { paramsTuple?: []; params?: {} }
    'leagues.show': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'searches.search': { paramsTuple?: []; params?: {} }
    'support.faqs': { paramsTuple?: []; params?: {} }
    'games.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'formations.index': { paramsTuple?: []; params?: {} }
    'formations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game_lineups.index': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'stages.bracket': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.standings': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.index_by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'teams.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.does_user_have_player_profile': { paramsTuple?: []; params?: {} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me_player.show': { paramsTuple?: []; params?: {} }
    'player_highlights.index': { paramsTuple?: []; params?: {} }
    'invites.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.league_player_requests': { paramsTuple?: []; params?: {} }
    'venues.index': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'stages.qualifiers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_zones.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'audit_logs.index': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'invites.generate': { paramsTuple?: []; params?: {} }
    'league_players.roster': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'auth_users.me': { paramsTuple?: []; params?: {} }
    'auth_users.managed': { paramsTuple?: []; params?: {} }
    'auth_users.teams': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'auth_users.search': { paramsTuple?: []; params?: {} }
    'countries.index': { paramsTuple?: []; params?: {} }
    'countries.show': { paramsTuple: [ParamValue]; params: {'idOrCode': ParamValue} }
    'leagues.index': { paramsTuple?: []; params?: {} }
    'leagues.show': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'searches.search': { paramsTuple?: []; params?: {} }
    'support.faqs': { paramsTuple?: []; params?: {} }
    'games.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'formations.index': { paramsTuple?: []; params?: {} }
    'formations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game_lineups.index': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'stages.bracket': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.standings': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.index_by_season': { paramsTuple: [ParamValue]; params: {'seasonId': ParamValue} }
    'teams.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.does_user_have_player_profile': { paramsTuple?: []; params?: {} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me_player.show': { paramsTuple?: []; params?: {} }
    'player_highlights.index': { paramsTuple?: []; params?: {} }
    'invites.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.league_player_requests': { paramsTuple?: []; params?: {} }
    'venues.index': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'stages.qualifiers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_zones.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'audit_logs.index': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'invites.generate': { paramsTuple?: []; params?: {} }
    'league_players.roster': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'auth.request_otp': { paramsTuple?: []; params?: {} }
    'auth.verify_otp': { paramsTuple?: []; params?: {} }
    'auth.request_recovery': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'leagues.store': { paramsTuple?: []; params?: {} }
    'support.bug_report': { paramsTuple?: []; params?: {} }
    'support.seed_faqs': { paramsTuple?: []; params?: {} }
    'me_player.store': { paramsTuple?: []; params?: {} }
    'me_player.photo': { paramsTuple?: []; params?: {} }
    'player_highlights.store': { paramsTuple?: []; params?: {} }
    'invites.complete_profile_and_accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'players.accept_league_player_request': { paramsTuple?: []; params?: {} }
    'favourite_leagues.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'game_score.update': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'stats.record_tracking_events': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_first_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_half_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_second_half': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_extra_time': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.pause': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.resume': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.end_game': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.start_penalty_shootout': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_time.complete_penalty_shootout': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'seasons.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'teams.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'team_admins.store': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'teamId': ParamValue} }
    'venues.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'stages.store': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'stages.seed': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.next_round': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.assign_groups': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.generate_fixtures': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stages.generate_knockout': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_overrides.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_zones.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'players.assign_team': { paramsTuple?: []; params?: {} }
    'games.store': { paramsTuple?: []; params?: {} }
    'stats.store': { paramsTuple?: []; params?: {} }
    'stats.record_substitutions': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'auth.delete_account': { paramsTuple?: []; params?: {} }
    'player_highlights.destroy': { paramsTuple: [ParamValue]; params: {'hid': ParamValue} }
    'favourite_leagues.destroy': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'game_lineups.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'id': ParamValue} }
    'teams.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'id': ParamValue} }
    'team_admins.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'leagueId': ParamValue,'teamId': ParamValue,'userId': ParamValue} }
    'venues.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.destroy': { paramsTuple: [ParamValue]; params: {'aid': ParamValue} }
    'standing_overrides.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'oid': ParamValue} }
    'standing_zones.destroy': { paramsTuple: [ParamValue]; params: {'zid': ParamValue} }
    'league_players.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'me_player.update': { paramsTuple?: []; params?: {} }
    'player_highlights.reorder': { paramsTuple?: []; params?: {} }
    'player_highlights.update': { paramsTuple: [ParamValue]; params: {'hid': ParamValue} }
    'player_awards.set_motm': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'game_lineups.set': { paramsTuple: [ParamValue]; params: {'gameId': ParamValue} }
    'leagues.update': { paramsTuple: [ParamValue]; params: {'leagueId': ParamValue} }
    'seasons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'seasonId': ParamValue} }
    'teams.update': { paramsTuple: [ParamValue,ParamValue]; params: {'leagueId': ParamValue,'id': ParamValue} }
    'venues.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'standing_adjustments.update': { paramsTuple: [ParamValue]; params: {'aid': ParamValue} }
    'standing_zones.update': { paramsTuple: [ParamValue]; params: {'zid': ParamValue} }
    'league_players.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'games.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stats.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'game_score.accredit': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'statId': ParamValue} }
    'game_lineups.update': { paramsTuple: [ParamValue,ParamValue]; params: {'gameId': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}