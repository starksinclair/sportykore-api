/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
  home: typeof routes['home']
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  auth: {
    requestOtp: typeof routes['auth.request_otp']
    verifyOtp: typeof routes['auth.verify_otp']
    requestRecovery: typeof routes['auth.request_recovery']
    logout: typeof routes['auth.logout']
    deleteAccount: typeof routes['auth.delete_account']
  }
  authUsers: {
    me: typeof routes['auth_users.me']
    managed: typeof routes['auth_users.managed']
    teams: typeof routes['auth_users.teams']
    search: typeof routes['auth_users.search']
  }
  countries: {
    index: typeof routes['countries.index']
    show: typeof routes['countries.show']
  }
  leagues: {
    index: typeof routes['leagues.index']
    show: typeof routes['leagues.show']
    store: typeof routes['leagues.store']
    update: typeof routes['leagues.update']
  }
  searches: {
    search: typeof routes['searches.search']
  }
  games: {
    show: typeof routes['games.show']
    store: typeof routes['games.store']
    update: typeof routes['games.update']
    destroy: typeof routes['games.destroy']
  }
  formations: {
    index: typeof routes['formations.index']
    show: typeof routes['formations.show']
  }
  gameLineups: {
    index: typeof routes['game_lineups.index']
    set: typeof routes['game_lineups.set']
    update: typeof routes['game_lineups.update']
    destroy: typeof routes['game_lineups.destroy']
  }
  stages: {
    bracket: typeof routes['stages.bracket']
    standings: typeof routes['stages.standings']
    indexBySeason: typeof routes['stages.index_by_season']
    store: typeof routes['stages.store']
    seed: typeof routes['stages.seed']
    nextRound: typeof routes['stages.next_round']
    assignGroups: typeof routes['stages.assign_groups']
    generateFixtures: typeof routes['stages.generate_fixtures']
    qualifiers: typeof routes['stages.qualifiers']
    generateKnockout: typeof routes['stages.generate_knockout']
  }
  teams: {
    show: typeof routes['teams.show']
    store: typeof routes['teams.store']
    update: typeof routes['teams.update']
    destroy: typeof routes['teams.destroy']
  }
  players: {
    doesUserHavePlayerProfile: typeof routes['players.does_user_have_player_profile']
    show: typeof routes['players.show']
    acceptLeaguePlayerRequest: typeof routes['players.accept_league_player_request']
    leaguePlayerRequests: typeof routes['players.league_player_requests']
    assignTeam: typeof routes['players.assign_team']
  }
  mePlayer: {
    show: typeof routes['me_player.show']
    store: typeof routes['me_player.store']
    update: typeof routes['me_player.update']
    photo: typeof routes['me_player.photo']
  }
  playerHighlights: {
    index: typeof routes['player_highlights.index']
    store: typeof routes['player_highlights.store']
    reorder: typeof routes['player_highlights.reorder']
    update: typeof routes['player_highlights.update']
    destroy: typeof routes['player_highlights.destroy']
  }
  invites: {
    accept: typeof routes['invites.accept']
    completeProfileAndAccept: typeof routes['invites.complete_profile_and_accept']
    generate: typeof routes['invites.generate']
  }
  favouriteLeagues: {
    store: typeof routes['favourite_leagues.store']
    destroy: typeof routes['favourite_leagues.destroy']
  }
  gameScore: {
    update: typeof routes['game_score.update']
    accredit: typeof routes['game_score.accredit']
  }
  playerAwards: {
    setMotm: typeof routes['player_awards.set_motm']
  }
  gameTime: {
    startFirstHalf: typeof routes['game_time.start_first_half']
    startHalfTime: typeof routes['game_time.start_half_time']
    startSecondHalf: typeof routes['game_time.start_second_half']
    startExtraTime: typeof routes['game_time.start_extra_time']
    pause: typeof routes['game_time.pause']
    resume: typeof routes['game_time.resume']
    endGame: typeof routes['game_time.end_game']
    startPenaltyShootout: typeof routes['game_time.start_penalty_shootout']
    completePenaltyShootout: typeof routes['game_time.complete_penalty_shootout']
  }
  seasons: {
    store: typeof routes['seasons.store']
    update: typeof routes['seasons.update']
  }
  teamAdmins: {
    store: typeof routes['team_admins.store']
    destroy: typeof routes['team_admins.destroy']
  }
  venues: {
    index: typeof routes['venues.index']
    store: typeof routes['venues.store']
    update: typeof routes['venues.update']
    destroy: typeof routes['venues.destroy']
  }
  standingAdjustments: {
    index: typeof routes['standing_adjustments.index']
    store: typeof routes['standing_adjustments.store']
    update: typeof routes['standing_adjustments.update']
    destroy: typeof routes['standing_adjustments.destroy']
  }
  standingOverrides: {
    store: typeof routes['standing_overrides.store']
    destroy: typeof routes['standing_overrides.destroy']
  }
  standingZones: {
    index: typeof routes['standing_zones.index']
    store: typeof routes['standing_zones.store']
    update: typeof routes['standing_zones.update']
    destroy: typeof routes['standing_zones.destroy']
  }
  auditLogs: {
    index: typeof routes['audit_logs.index']
  }
  leaguePlayers: {
    roster: typeof routes['league_players.roster']
    update: typeof routes['league_players.update']
    destroy: typeof routes['league_players.destroy']
  }
  stats: {
    store: typeof routes['stats.store']
    recordSubstitutions: typeof routes['stats.record_substitutions']
    update: typeof routes['stats.update']
    destroy: typeof routes['stats.destroy']
  }
}
