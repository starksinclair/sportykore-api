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
  gameTime: {
    startFirstHalf: typeof routes['game_time.start_first_half']
    startHalfTime: typeof routes['game_time.start_half_time']
    startSecondHalf: typeof routes['game_time.start_second_half']
    startExtraTime: typeof routes['game_time.start_extra_time']
    pause: typeof routes['game_time.pause']
    resume: typeof routes['game_time.resume']
    endGame: typeof routes['game_time.end_game']
  }
  seasons: {
    store: typeof routes['seasons.store']
    update: typeof routes['seasons.update']
  }
  teamAdmins: {
    store: typeof routes['team_admins.store']
    destroy: typeof routes['team_admins.destroy']
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
