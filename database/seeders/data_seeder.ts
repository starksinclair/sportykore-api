import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import Country from '#models/country'
import FavouriteLeague from '#models/favourite_league'
import Formation from '#models/formation'
import Game from '#models/game'
import GameLineup from '#models/game_lineup'
import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import Tie from '#models/tie'
import type User from '#models/user'
import StatType from '#models/stat_type'
import Player from '#models/player'
import LeaguePlayer from '#models/league_player'
import Stat from '#models/stat'
import StandingService from '#services/standing_service'
import StageService from '#services/stage_service'
import BracketService from '#services/bracket_service'
import TieResolver from '#services/tie_resolver'
import type { FormationSlot } from '#types/formation'

import UserFactory from '#factories/user_factory'
import {
  footballerName,
  leagueLogoUrl,
  playerAvatarUrl,
  teamLogoUrl,
} from '../data/seed_footballers.js'

const USER_COUNT = 15
const LEAGUES_PER_USER = 2
const SEASONS_PER_LEAGUE = 2
const TEAMS_PER_LEAGUE = 10
const KNOCKOUT_SEED_TEAM_COUNT = 8
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
const LINEUP_SUBSTITUTES = 3
const MIN_STATS_PER_GAME = 5
const MAX_STATS_PER_GAME = 12

const SEASON_STATUSES = ['completed', 'active'] as const
const DEFAULT_FORMATION_NAME = '4-3-3'

type Fixture = {
  homeTeam: Team
  awayTeam: Team
}

export default class DataSeeder extends BaseSeeder {
  private standingService = new StandingService()
  private stageService = new StageService()
  private bracketService = new BracketService(this.stageService, new TieResolver())
  private tieResolver = new TieResolver()
  private statTypesByName = new Map<string, StatType>()
  private playerNameIndex = 0

  async run() {
    const countries = await this.loadAfricanCountries()
    await this.loadStatTypes()
    const formation = await Formation.findByOrFail('name', DEFAULT_FORMATION_NAME)
    const formationSlots = this.parseFormationSlots(formation)

    const users = await UserFactory.createMany(USER_COUNT)
    const leagues: League[] = []

    for (const [userIndex, user] of users.entries()) {
      for (let leagueIndex = 0; leagueIndex < LEAGUES_PER_USER; leagueIndex++) {
        const country = countries[userIndex * LEAGUES_PER_USER + leagueIndex]
        if (!country) {
          throw new Error('Not enough countries to seed all leagues.')
        }

        // leagueIndex 0 → round-robin league; 1 → knockout cup
        const isKnockout = leagueIndex === 1
        const competitionName = isKnockout
          ? `${country.name} Cup ${userIndex + 1}`
          : `${country.name} League ${userIndex + 1}-${leagueIndex + 1}`

        const league = await League.create({
          userId: user.id,
          countryId: country.id,
          name: competitionName,
          description: isKnockout
            ? `Seeded knockout cup for ${user.fullName ?? user.email}.`
            : `Seeded league for ${user.fullName ?? user.email}.`,
          gender: 'mixed',
          logoUrl: leagueLogoUrl(competitionName),
        })

        leagues.push(league)

        const { teams, teamPlayers } = await this.seedTeams(league, country, user)
        await this.seedTeamAdmins(league, teams, user, users)

        for (let seasonIndex = 0; seasonIndex < SEASONS_PER_LEAGUE; seasonIndex++) {
          const season = await Season.create({
            leagueId: league.id,
            name: `${DateTime.now().year} Season ${seasonIndex + 1}`,
            status: SEASON_STATUSES[seasonIndex] ?? 'active',
          })

          const playersByTeam = await this.seedLeaguePlayers(league, season, teams, teamPlayers)

          if (isKnockout) {
            await this.seedKnockoutSeason(league, season, teams, playersByTeam, formation, formationSlots)
          } else {
            const fixtures = this.buildFixtures(teams)
            const stage = await this.stageService.ensureRoundRobinStage(season.id)
            await this.seedStandings(league, season, teams)
            await this.seedGames(
              league,
              season,
              stage.id,
              fixtures,
              country.name,
              playersByTeam,
              formation,
              formationSlots
            )
            await this.recalculateStandings(season.id, teams)
          }
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

  private nextFootballerName() {
    const name = footballerName(this.playerNameIndex)
    this.playerNameIndex += 1
    return name
  }

  private async seedTeams(league: League, country: Country, user: User) {
    const teams: Team[] = []
    const teamPlayers: Player[][] = []

    for (let index = 0; index < TEAMS_PER_LEAGUE; index++) {
      const suffix = TEAM_SUFFIXES[index % TEAM_SUFFIXES.length]
      const teamName = `${country.name} ${suffix} ${index + 1}`
      const team = await Team.create({
        leagueId: league.id,
        addedBy: user.id,
        name: teamName,
        logoUrl: teamLogoUrl(teamName),
      })

      teams.push(team)

      const players: Player[] = []
      for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
        const playerName = this.nextFootballerName()
        const playerEmail = `player.l${league.id}.t${team.id}.n${p}@sportykore.seed`

        const playerUser = await UserFactory.merge({
          email: playerEmail,
          fullName: playerName,
        }).create()

        const player = await Player.create({
          addedBy: user.id,
          userId: playerUser.id,
          countryId: country.id,
          name: playerName,
          bio: null,
          avatarUrl: playerAvatarUrl(playerName),
        })

        players.push(player)
      }

      teamPlayers.push(players)
    }

    return { teams, teamPlayers }
  }

  private async seedTeamAdmins(league: League, teams: Team[], owner: User, users: User[]) {
    const candidate = users.find((user) => user.id !== owner.id)
    if (!candidate || teams.length === 0) {
      return
    }

    await TeamAdmin.create({
      leagueId: league.id,
      teamId: teams[0]!.id,
      userId: candidate.id,
      assignedBy: owner.id,
    })

    if (teams.length > 1) {
      const secondCandidate = users.find((user) => user.id !== owner.id && user.id !== candidate.id)
      if (secondCandidate) {
        await TeamAdmin.create({
          leagueId: league.id,
          teamId: teams[1]!.id,
          userId: secondCandidate.id,
          assignedBy: owner.id,
        })
      }
    }
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

  private async seedKnockoutSeason(
    league: League,
    season: Season,
    teams: Team[],
    playersByTeam: Map<number, Player[]>,
    formation: Formation,
    formationSlots: FormationSlot[]
  ) {
    const stage = await this.stageService.createKnockoutStage(league.id, season.id, {
      name: 'Cup',
      config: {
        format: { starting_round: 'qf', has_third_place: false },
        ties: { default: { tie_format: 'single' } },
      },
    })

    const seededTeams = teams.slice(0, KNOCKOUT_SEED_TEAM_COUNT)
    await this.bracketService.generateKnockoutPhase(
      stage.id,
      seededTeams.map((team) => team.id)
    )

    const qfTies = await Tie.query()
      .where('stage_id', stage.id)
      .where('round', 'qf')
      .where('is_bye', false)
      .orderBy('bracket_position', 'asc')

    for (const [index, tie] of qfTies.entries()) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      game.status = 'full_time'
      game.homeScore = 2
      game.awayScore = 1
      game.winnerTeamId = game.homeTeamId
      game.playedAt = DateTime.utc().minus({ days: 7 - index })
      await game.save()

      const homePlayers = playersByTeam.get(game.homeTeamId) ?? []
      const awayPlayers = playersByTeam.get(game.awayTeamId) ?? []
      await this.seedLineupsForGame(
        game,
        formation,
        formationSlots,
        game.homeTeamId,
        game.awayTeamId,
        homePlayers,
        awayPlayers
      )

      await this.tieResolver.advanceTie(tie.id)
    }

    await this.bracketService.generateNextRound(stage.id, 'qf')
  }

  private async seedGames(
    league: League,
    season: Season,
    stageId: number,
    fixtures: Fixture[],
    countryName: string,
    playersByTeam: Map<number, Player[]>,
    formation: Formation,
    formationSlots: FormationSlot[]
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
        stageId,
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

      const homePlayers = playersByTeam.get(fixture.homeTeam.id) ?? []
      const awayPlayers = playersByTeam.get(fixture.awayTeam.id) ?? []
      await this.seedLineupsForGame(
        game,
        formation,
        formationSlots,
        fixture.homeTeam.id,
        fixture.awayTeam.id,
        homePlayers,
        awayPlayers
      )

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

  private async seedLineupsForGame(
    game: Game,
    formation: Formation,
    formationSlots: FormationSlot[],
    homeTeamId: number,
    awayTeamId: number,
    homePlayers: Player[],
    awayPlayers: Player[]
  ) {
    await this.seedTeamLineup(game, formation, formationSlots, homeTeamId, homePlayers)
    await this.seedTeamLineup(game, formation, formationSlots, awayTeamId, awayPlayers)
  }

  private async seedTeamLineup(
    game: Game,
    formation: Formation,
    formationSlots: FormationSlot[],
    teamId: number,
    players: Player[]
  ) {
    if (players.length < formationSlots.length) {
      return
    }

    const starterRows = formationSlots.map((slot, index) => ({
      gameId: game.id,
      teamId,
      playerId: players[index]!.id,
      formationId: formation.id,
      slotKey: slot.key,
      position: slot.position,
      status: 'starter' as const,
      jerseyNumber: index + 1,
      startingOrder: index + 1,
    }))

    const substituteRows = players
      .slice(formationSlots.length, formationSlots.length + LINEUP_SUBSTITUTES)
      .map((player, index) => ({
        gameId: game.id,
        teamId,
        playerId: player.id,
        formationId: formation.id,
        slotKey: null,
        position: null,
        status: 'substitute' as const,
        jerseyNumber: formationSlots.length + index + 1,
        startingOrder: null,
      }))

    await GameLineup.createMany([...starterRows, ...substituteRows])
  }

  private parseFormationSlots(formation: Formation): FormationSlot[] {
    if (typeof formation.slots === 'string') {
      return JSON.parse(formation.slots) as FormationSlot[]
    }

    return formation.slots as FormationSlot[]
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
