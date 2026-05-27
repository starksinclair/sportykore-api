/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
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
  users: {
    signup: typeof routes['users.signup']
    login: typeof routes['users.login']
    forgotPassword: typeof routes['users.forgot_password']
    resetPassword: typeof routes['users.reset_password']
    googleRedirect: typeof routes['users.google_redirect']
    googleCallback: typeof routes['users.google_callback']
    logout: typeof routes['users.logout']
  }
  authUsers: {
    me: typeof routes['auth_users.me']
    leagues: typeof routes['auth_users.leagues']
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
  teams: {
    show: typeof routes['teams.show']
    store: typeof routes['teams.store']
    update: typeof routes['teams.update']
  }
  players: {
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
  seasons: {
    store: typeof routes['seasons.store']
  }
  leaguePlayers: {
    roster: typeof routes['league_players.roster']
    update: typeof routes['league_players.update']
    destroy: typeof routes['league_players.destroy']
  }
  stats: {
    store: typeof routes['stats.store']
    update: typeof routes['stats.update']
    destroy: typeof routes['stats.destroy']
  }
}
