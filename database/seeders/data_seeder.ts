import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import Country from '#models/country'
import FavouriteLeague from '#models/favourite_league'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'
import type User from '#models/user'
import StatType from '#models/stat_type'
import Player from '#models/player'
import LeaguePlayer from '#models/league_player'
import Stat from '#models/stat'
import StandingService from '#services/standing_service'

import UserFactory from '#factories/user_factory'

const USER_COUNT = 15
const LEAGUES_PER_USER = 2
const SEASONS_PER_LEAGUE = 2
const TEAMS_PER_LEAGUE = 10
const GAMES_PER_SEASON = 21

const AFRICAN_COUNTRY_CODES = [
  'ao',
  'bf',
  'bi',
  'bj',
  'bw',
  'cd',
  'cf',
  'cg',
  'ci',
  'cm',
  'cv',
  'dj',
  'dz',
  'eg',
  'er',
  'et',
  'ga',
  'gh',
  'gm',
  'gn',
  'gq',
  'gw',
  'ke',
  'km',
  'lr',
  'ls',
  'ly',
  'ma',
  'mg',
  'ml',
  'mr',
  'mu',
  'mw',
  'mz',
  'na',
  'ne',
  'ng',
  'rw',
  'sc',
  'sd',
  'sl',
  'sn',
  'so',
  'st',
  'sz',
  'td',
  'tg',
  'tn',
  'tz',
  'ug',
  'za',
  'zm',
  'zw',
] as const

const TEAM_SUFFIXES = [
  'United',
  'City',
  'Rovers',
  'Athletic',
  'Warriors',
  'Stars',
  'Dynamos',
  'Eagles',
  'Strikers',
  'FC',
] as const

const PLAYERS_PER_TEAM = 14
const MIN_STATS_PER_GAME = 5
const MAX_STATS_PER_GAME = 12

const SEASON_STATUSES = ['completed', 'active'] as const

type Fixture = {
  homeTeam: Team
  awayTeam: Team
}

export default class DataSeeder extends BaseSeeder {
  private standingService = new StandingService()
  private statTypesByName = new Map<string, StatType>()

  async run() {
    const countries = await this.loadAfricanCountries()
    await this.loadStatTypes()

    const users = await UserFactory.createMany(USER_COUNT)
    const leagues: League[] = []

    for (const [userIndex, user] of users.entries()) {
      for (let leagueIndex = 0; leagueIndex < LEAGUES_PER_USER; leagueIndex++) {
        const country = countries[userIndex * LEAGUES_PER_USER + leagueIndex]
        if (!country) {
          throw new Error('Not enough countries to seed all leagues.')
        }

        const league = await League.create({
          userId: user.id,
          countryId: country.id,
          name: `${country.name} League ${userIndex + 1}-${leagueIndex + 1}`,
          description: `Seeded league for ${user.fullName ?? user.email}.`,
          gender: 'mixed',
          logoUrl: null,
        })

        leagues.push(league)

        const { teams, teamPlayers } = await this.seedTeams(league, country, user)
        const fixtures = this.buildFixtures(teams)

        for (let seasonIndex = 0; seasonIndex < SEASONS_PER_LEAGUE; seasonIndex++) {
          const season = await Season.create({
            leagueId: league.id,
            name: `${DateTime.now().year} Season ${seasonIndex + 1}`,
            status: SEASON_STATUSES[seasonIndex] ?? 'active',
          })

          const playersByTeam = await this.seedLeaguePlayers(league, season, teams, teamPlayers)
          await this.seedStandings(league, season, teams)
          await this.seedGames(league, season, fixtures, country.name, playersByTeam)
          await this.recalculateStandings(season.id, teams)
        }
      }
    }

    await this.seedFavouriteLeagues(users, leagues)
  }

  private async loadAfricanCountries() {
    const countries = await Country.query()
      .whereIn('code', Array.from(AFRICAN_COUNTRY_CODES))
      .orderBy('name', 'asc')

    const byCode = new Map(countries.map((country) => [country.code.toLowerCase(), country]))
    const orderedCountries = AFRICAN_COUNTRY_CODES.map((code) => byCode.get(code)).filter(
      (country): country is Country => Boolean(country)
    )

    const required = USER_COUNT * LEAGUES_PER_USER

    if (orderedCountries.length < required) {
      const allCountries = await Country.query().orderBy('name', 'asc')
      if (allCountries.length < required) {
        throw new Error(
          `Need at least ${required} countries, but only ${allCountries.length} exist in the database.`
        )
      }
      return allCountries.slice(0, required)
    }

    return orderedCountries.slice(0, required)
  }

  private async loadStatTypes() {
    const statTypes = await StatType.query()
    this.statTypesByName = new Map(statTypes.map((statType) => [statType.name, statType]))

    for (const name of ['goals', 'assists', 'yellow_card'] as const) {
      if (!this.statTypesByName.has(name)) {
        throw new Error(`Stat type "${name}" not found — run migrations first.`)
      }
    }
  }

  private async seedTeams(league: League, country: Country, user: User) {
    const teams: Team[] = []
    const teamPlayers: Player[][] = []

    for (let index = 0; index < TEAMS_PER_LEAGUE; index++) {
      const suffix = TEAM_SUFFIXES[index % TEAM_SUFFIXES.length]
      const team = await Team.create({
        leagueId: league.id,
        addedBy: user.id,
        name: `${country.name} ${suffix} ${index + 1}`,
        logoUrl: null,
      })

      teams.push(team)

      const players: Player[] = []
      for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
        const playerEmail = `player.l${league.id}.t${team.id}.n${p}@sportykore.seed`
        const playerFullName = `${team.name} Player ${p + 1}`

        const playerUser = await UserFactory.merge({
          email: playerEmail,
          fullName: playerFullName,
        }).create()

        const player = await Player.create({
          addedBy: user.id,
          userId: playerUser.id,
          countryId: country.id,
          name: playerFullName,
          bio: null,
          avatarUrl: null,
        })

        players.push(player)
      }

      teamPlayers.push(players)
    }

    return { teams, teamPlayers }
  }

  private buildFixtures(teams: Team[]): Fixture[] {
    const fixtures: Fixture[] = []

    for (let homeIndex = 0; homeIndex < teams.length; homeIndex++) {
      for (let awayIndex = homeIndex + 1; awayIndex < teams.length; awayIndex++) {
        const homeTeam = fixtures.length % 2 === 0 ? teams[homeIndex]! : teams[awayIndex]!
        const awayTeam = fixtures.length % 2 === 0 ? teams[awayIndex]! : teams[homeIndex]!

        fixtures.push({ homeTeam, awayTeam })

        if (fixtures.length === GAMES_PER_SEASON) {
          return fixtures
        }
      }
    }

    return fixtures
  }

  private async seedGames(
    league: League,
    season: Season,
    fixtures: Fixture[],
    countryName: string,
    playersByTeam: Map<number, Player[]>
  ) {
    // Games start 8 days ago: indices 0–7 are full_time (past), index 8 is first_half (today), 9+ are scheduled (future)
    const baseDate = DateTime.now().startOf('day').minus({ days: 8 })
    const eventStatTypes = [
      this.statTypesByName.get('goals')!,
      this.statTypesByName.get('assists')!,
      this.statTypesByName.get('yellow_card')!,
    ]

    for (const [index, fixture] of fixtures.entries()) {
      const playedAt = baseDate.plus({ days: index })
      const status = index < 8 ? 'full_time' : index === 8 ? 'first_half' : 'scheduled'
      const homeScore = status === 'scheduled' ? null : (index % 4) + (status === 'first_half' ? 1 : 0)
      const awayScore =
        status === 'scheduled' ? null : ((index + 1) % 3) + (status === 'first_half' ? 1 : 0)

      const game = await Game.create({
        leagueId: league.id,
        seasonId: season.id,
        homeTeamId: fixture.homeTeam.id,
        awayTeamId: fixture.awayTeam.id,
        playedAt,
        homeScore,
        awayScore,
        firstHalfDuration: 45,
        secondHalfDuration: 45,
        firstHalfStartedAt:
          status === 'full_time'
            ? playedAt
            : status === 'first_half'
              ? DateTime.utc().minus({ minutes: 63 })
              : undefined,
        secondHalfStartedAt: status === 'full_time' ? playedAt.plus({ hours: 1 }) : undefined,
        status,
        venueName: `${countryName} Stadium ${index + 1}`,
      })

      if (status === 'scheduled') {
        continue
      }

      const statCount =
        Math.floor(Math.random() * (MAX_STATS_PER_GAME - MIN_STATS_PER_GAME + 1)) +
        MIN_STATS_PER_GAME

      for (let s = 0; s < statCount; s++) {
        const isHome = Math.random() < 0.5
        const team = isHome ? fixture.homeTeam : fixture.awayTeam
        const players = playersByTeam.get(team.id) ?? []
        if (players.length === 0) continue

        const player = players[Math.floor(Math.random() * players.length)]!
        const statType = eventStatTypes[Math.floor(Math.random() * eventStatTypes.length)]!

        await Stat.create({
          gameId: game.id,
          leagueId: league.id,
          seasonId: season.id,
          playerId: player.id,
          teamId: team.id,
          statTypeId: statType.id,
          minute: Math.floor(Math.random() * 90) + 1,
          numericValue: 1,
          value: null,
          isStoppageTime: false,
        })
      }
    }
  }

  private async seedLeaguePlayers(
    league: League,
    season: Season,
    teams: Team[],
    teamPlayers: Player[][]
  ) {
    const map = new Map<number, Player[]>()

    for (const [i, team] of teams.entries()) {
      const players = teamPlayers[i] ?? []
      const created: Player[] = []

      for (const [p, player] of players.entries()) {
        await LeaguePlayer.create({
          leagueId: league.id,
          seasonId: season.id,
          playerId: player.id,
          teamId: team.id,
          joinedAt: DateTime.now(),
          jerseyNumber: String(p + 1),
          isCaptain: p === 0,
          status: 'active',
          position: this.rosterPositionForIndex(p),
        })

        created.push(player)
      }

      map.set(team.id, created)
    }

    return map
  }

  private async seedStandings(league: League, season: Season, teams: Team[]) {
    await this.standingService.ensureForTeams(
      league.id,
      season.id,
      teams.map((team) => team.id)
    )
  }

  private async recalculateStandings(seasonId: number, teams: Team[]) {
    for (const team of teams) {
      await this.standingService.recalculate(seasonId, team.id)
    }
  }

  private async seedFavouriteLeagues(users: User[], leagues: League[]) {
    for (const [userIndex, user] of users.entries()) {
      const firstIndex = userIndex * LEAGUES_PER_USER
      const firstLeague = leagues[firstIndex]
      const secondLeague = leagues[firstIndex + 1]

      if (!firstLeague || !secondLeague) {
        throw new Error('Not enough leagues to seed favourites.')
      }

      await FavouriteLeague.updateOrCreate(
        { userId: user.id, leagueId: firstLeague.id },
        { userId: user.id, leagueId: firstLeague.id }
      )

      await FavouriteLeague.updateOrCreate(
        { userId: user.id, leagueId: secondLeague.id },
        { userId: user.id, leagueId: secondLeague.id }
      )
    }
  }

  private rosterPositionForIndex(
    index: number
  ): 'attack' | 'defence' | 'midfield' | 'goalkeeper' {
    if (index === 0) {
      return 'goalkeeper'
    }

    const outfield = ['defence', 'midfield', 'attack'] as const
    return outfield[(index - 1) % outfield.length]!
  }
}
