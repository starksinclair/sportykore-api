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
import PlayerAward from '#models/player_award'
import PlayerHighlight from '#models/player_highlight'
import LeaguePlayer from '#models/league_player'
import Stat from '#models/stat'
import type { PlayerPosition, PreferredFoot } from '#types/player'
import StandingService from '#services/standing_service'
import StageService from '#services/stage_service'
import BracketService from '#services/bracket_service'
import TieResolver from '#services/tie_resolver'
import GroupStageService from '#services/group_stage_service'
import QualifierService from '#services/qualifier_service'
import StageStandingService from '#services/stage_standing_service'
import StandingAdjustmentService from '#services/standing_adjustment_service'
import StandingOverrideService from '#services/standing_override_service'
import StandingZoneService from '#services/standing_zone_service'
import type { FormationSlot } from '#types/formation'

import UserFactory from '#factories/user_factory'
import {
  footballerName,
  leagueLogoUrl,
  playerAvatarUrl,
  teamLogoUrl,
} from '../data/seed_footballers.js'

const USER_COUNT = 15
const LEAGUES_PER_USER = 3
const SEASONS_PER_LEAGUE = 2
const TEAMS_PER_LEAGUE = 10
const KNOCKOUT_SEED_TEAM_COUNT = 8
const GROUP_STAGE_TEAM_COUNT = 8
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

const CITY_SUFFIXES = ['Central', 'Port', 'Heights', 'Springs', 'Valley', 'Bay'] as const
const PREFERRED_FEET_CYCLE = [
  'right',
  'right',
  'left',
  'both',
] as const satisfies readonly PreferredFoot[]
const HEIGHT_RANGES_CM: Record<PlayerPosition, readonly [number, number]> = {
  goalkeeper: [185, 198],
  defence: [175, 190],
  midfield: [168, 182],
  attack: [170, 185],
}
const HIGHLIGHT_TITLES = [
  'Hat-trick highlights',
  "Season's best goals",
  'Man of the match display',
  'Assist compilation',
  'Debut season highlights',
] as const
/** Every Nth seeded player (by creation order) gets sample highlight clips. */
const HIGHLIGHT_PLAYER_INTERVAL = 5

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
  private groupStageService = new GroupStageService()
  private stageStandingService = new StageStandingService()
  private qualifierService = new QualifierService()
  private standingAdjustmentService = new StandingAdjustmentService()
  private standingOverrideService = new StandingOverrideService()
  private standingZoneService = new StandingZoneService()
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

        // leagueIndex 0 → round-robin league; 1 → knockout cup; 2 → group championship
        const format = leagueIndex === 1 ? 'knockout' : leagueIndex === 2 ? 'group' : 'league'
        const competitionName =
          format === 'knockout'
            ? `${country.name} Cup ${userIndex + 1}`
            : format === 'group'
              ? `${country.name} Championship ${userIndex + 1}`
              : `${country.name} League ${userIndex + 1}-${leagueIndex + 1}`

        const league = await League.create({
          userId: user.id,
          countryId: country.id,
          name: competitionName,
          description:
            format === 'knockout'
              ? `Seeded knockout cup for ${user.fullName ?? user.email}.`
              : format === 'group'
                ? `Seeded group championship for ${user.fullName ?? user.email}.`
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

          if (format === 'knockout') {
            await this.seedKnockoutSeason(
              league,
              season,
              teams,
              playersByTeam,
              formation,
              formationSlots
            )
          } else if (format === 'group') {
            await this.seedGroupSeason(
              user,
              league,
              season,
              teams,
              playersByTeam,
              formation,
              formationSlots
            )
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

    for (const name of ['goals', 'assists', 'yellow_card', 'pass', 'shot'] as const) {
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
        const globalPlayerIndex = this.playerNameIndex - 1
        const playerEmail = `player.l${league.id}.t${team.id}.n${p}@sportykore.seed`

        const playerUser = await UserFactory.merge({
          email: playerEmail,
          fullName: playerName,
        }).create()

        const primaryPosition = this.rosterPositionForIndex(p)
        const secondaryPosition = this.secondaryPositionFor(p, primaryPosition)
        const [minHeight, maxHeight] = HEIGHT_RANGES_CM[primaryPosition]

        const player = await Player.create({
          addedBy: user.id,
          userId: playerUser.id,
          countryId: country.id,
          name: playerName,
          bio: `${playerName} is a ${primaryPosition} for ${teamName}.`,
          avatarUrl: playerAvatarUrl(playerName),
          primaryPosition,
          secondaryPosition,
          preferredFoot: PREFERRED_FEET_CYCLE[p % PREFERRED_FEET_CYCLE.length],
          heightCm: minHeight + Math.floor(Math.random() * (maxHeight - minHeight + 1)),
          dateOfBirth: DateTime.now().minus({
            years: 17 + Math.floor(Math.random() * 18),
            days: Math.floor(Math.random() * 300),
          }),
          city: `${country.name} ${CITY_SUFFIXES[(index + p) % CITY_SUFFIXES.length]}`,
          state: null,
          nationality: country.name,
          socialHandle: `@${this.socialHandleSlug(playerName)}`,
          // One private player per league (first team's goalkeeper) so the
          // stub-on-every-surface rule has a real row to exercise manually.
          visibility: index === 0 && p === 0 ? 'private' : 'active',
        })

        if (globalPlayerIndex % HIGHLIGHT_PLAYER_INTERVAL === 0) {
          await this.seedHighlightsForPlayer(player)
        }

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
      await this.seedMotmAward(game, homePlayers, awayPlayers)

      await this.tieResolver.advanceTie(tie.id)
    }

    await this.bracketService.generateNextRound(stage.id, 'qf')
  }

  private async seedGroupSeason(
    owner: User,
    league: League,
    season: Season,
    teams: Team[],
    playersByTeam: Map<number, Player[]>,
    formation: Formation,
    formationSlots: FormationSlot[]
  ) {
    const audit = { leagueId: league.id, actorId: owner.id }

    const { stage, groups } = await this.groupStageService.createGroupStage(
      league.id,
      season.id,
      {
        name: 'Group Stage',
        config: {
          format: { group_count: 2, double_round_robin: false },
          advancement: { per_group: 2 },
        },
      },
      undefined,
      { actorId: owner.id }
    )

    const groupTeams = teams.slice(0, GROUP_STAGE_TEAM_COUNT)
    const assignments = await this.groupStageService.assignTeams(
      stage.id,
      { mode: 'auto', teamIds: groupTeams.map((team) => team.id) },
      audit
    )
    await this.groupStageService.generateGroupFixtures(stage.id, audit)

    // Bottom-of-group elimination band alongside the auto-created qualified zone
    const teamsPerGroup = GROUP_STAGE_TEAM_COUNT / groups.length
    await this.standingZoneService.create(
      stage.id,
      {
        positionStart: teamsPerGroup,
        positionEnd: teamsPerGroup,
        zoneType: 'relegation',
        label: 'Eliminated',
      },
      audit
    )

    const isCompleted = season.status === 'completed'
    const [groupA, groupB] = groups

    for (const group of groups) {
      const games = await Game.query()
        .where('stage_id', stage.id)
        .where('stage_group_id', group.id)
        .orderBy('played_at', 'asc')

      // Group B in completed seasons is all draws so the whole group ties on
      // points + played — that cohort is then reordered via a standing override.
      const allDraws = isCompleted && group.id === groupB?.id
      const playedCount = isCompleted ? games.length : Math.ceil(games.length / 2)

      for (const [index, game] of games.entries()) {
        if (index > playedCount) {
          continue
        }

        const isLive = !isCompleted && index === playedCount

        if (isLive) {
          game.status = 'first_half'
          game.homeScore = 1
          game.awayScore = 0
          game.playedAt = DateTime.utc().minus({ minutes: 30 })
          game.firstHalfStartedAt = DateTime.utc().minus({ minutes: 30 })
        } else {
          const playedAt = DateTime.utc()
            .startOf('day')
            .minus({ days: playedCount - index + 1 })
          game.status = 'full_time'
          game.homeScore = allDraws ? 1 : (index % 3) + 1
          game.awayScore = allDraws ? 1 : index % 2
          game.winnerTeamId =
            game.homeScore > game.awayScore
              ? game.homeTeamId
              : game.awayScore > game.homeScore
                ? game.awayTeamId
                : null
          game.playedAt = playedAt
          game.firstHalfStartedAt = playedAt
          game.secondHalfStartedAt = playedAt.plus({ hours: 1 })
        }

        game.firstHalfDuration = 45
        game.secondHalfDuration = 45
        await game.save()

        await this.seedLineupsForGame(
          game,
          formation,
          formationSlots,
          game.homeTeamId,
          game.awayTeamId,
          playersByTeam.get(game.homeTeamId) ?? [],
          playersByTeam.get(game.awayTeamId) ?? []
        )
        await this.seedMotmAward(
          game,
          playersByTeam.get(game.homeTeamId) ?? [],
          playersByTeam.get(game.awayTeamId) ?? []
        )
        await this.seedStatsForGame(game, playersByTeam)
      }
    }

    // Points deduction for the last-seeded team in group A
    const groupATeamIds = assignments
      .filter((assignment) => assignment.stageGroupId === groupA!.id)
      .map((assignment) => assignment.teamId)
    await this.standingAdjustmentService.create(
      stage.id,
      {
        teamId: groupATeamIds[groupATeamIds.length - 1]!,
        stageGroupId: groupA!.id,
        pointsDelta: -3,
        reason: 'Fielded an ineligible player',
        createdBy: owner.id,
      },
      audit
    )

    if (!isCompleted) {
      return
    }

    // Reorder the fully tied group B cohort with a manual override
    const groupBRows = await this.stageStandingService.rawTableRows(stage.id, groupB!.id)
    const isFullCohort =
      groupBRows.length >= 2 &&
      groupBRows.every(
        (row) => row.points === groupBRows[0]!.points && row.played === groupBRows[0]!.played
      )
    if (isFullCohort) {
      await this.standingOverrideService.setCohort(
        stage.id,
        {
          stageGroupId: groupB!.id,
          reason: 'Fair-play ranking applied by organizer',
          createdBy: owner.id,
          ranks: [...groupBRows]
            .reverse()
            .map((row, index) => ({ teamId: row.teamId, manualRank: index + 1 })),
        },
        audit
      )
    }

    // Qualifiers → knockout (marks the group stage completed)
    const knockout = await this.qualifierService.generateKnockout(
      stage.id,
      { name: 'Knockout', targetRound: 'sf' },
      audit
    )

    const sfTies = await Tie.query()
      .where('stage_id', knockout.stage.id)
      .where('round', 'sf')
      .where('is_bye', false)
      .orderBy('bracket_position', 'asc')

    for (const [index, tie] of sfTies.entries()) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      game.status = 'full_time'
      game.homeScore = 2
      game.awayScore = 1
      game.winnerTeamId = game.homeTeamId
      game.playedAt = DateTime.utc().minus({ days: 2 - index })
      await game.save()

      await this.seedLineupsForGame(
        game,
        formation,
        formationSlots,
        game.homeTeamId,
        game.awayTeamId,
        playersByTeam.get(game.homeTeamId) ?? [],
        playersByTeam.get(game.awayTeamId) ?? []
      )
      await this.seedMotmAward(
        game,
        playersByTeam.get(game.homeTeamId) ?? [],
        playersByTeam.get(game.awayTeamId) ?? []
      )
      await this.tieResolver.advanceTie(tie.id)
    }

    await this.bracketService.generateNextRound(knockout.stage.id, 'sf')
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

    for (const [index, fixture] of fixtures.entries()) {
      const playedAt = baseDate.plus({ days: index })
      const status = index < 8 ? 'full_time' : index === 8 ? 'first_half' : 'scheduled'
      const homeScore =
        status === 'scheduled' ? null : (index % 4) + (status === 'first_half' ? 1 : 0)
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

      await this.seedMotmAward(game, homePlayers, awayPlayers)
      await this.seedStatsForGame(game, playersByTeam)
    }
  }

  private async seedMotmAward(game: Game, homePlayers: Player[], awayPlayers: Player[]) {
    const pool = [...homePlayers.slice(0, 11), ...awayPlayers.slice(0, 11)]
    if (pool.length === 0) {
      return
    }

    const winnerPool = game.winnerTeamId === game.awayTeamId ? awayPlayers : homePlayers
    const candidates = winnerPool.length > 0 ? winnerPool.slice(0, 11) : pool
    const player = candidates[Math.floor(Math.random() * candidates.length)]!

    await PlayerAward.updateOrCreate(
      { gameId: game.id, awardType: 'motm' },
      { playerId: player.id, awardedBy: null }
    )
  }

  private async seedStatsForGame(game: Game, playersByTeam: Map<number, Player[]>) {
    const eventStatTypes = [
      this.statTypesByName.get('goals')!,
      this.statTypesByName.get('assists')!,
      this.statTypesByName.get('yellow_card')!,
    ]

    const statCount =
      Math.floor(Math.random() * (MAX_STATS_PER_GAME - MIN_STATS_PER_GAME + 1)) + MIN_STATS_PER_GAME

    for (let s = 0; s < statCount; s++) {
      const teamId = Math.random() < 0.5 ? game.homeTeamId : game.awayTeamId
      const players = playersByTeam.get(teamId) ?? []
      if (players.length === 0) continue

      const player = players[Math.floor(Math.random() * players.length)]!
      const statType = eventStatTypes[Math.floor(Math.random() * eventStatTypes.length)]!

      await Stat.create({
        gameId: game.id,
        leagueId: game.leagueId,
        seasonId: game.seasonId,
        playerId: player.id,
        teamId,
        statTypeId: statType.id,
        minute: Math.floor(Math.random() * 90) + 1,
        numericValue: 1,
        value: null,
        isStoppageTime: false,
      })
    }

    await this.seedTrackingStatsForGame(game, playersByTeam)
  }

  private async seedTrackingStatsForGame(game: Game, playersByTeam: Map<number, Player[]>) {
    const passType = this.statTypesByName.get('pass')!
    const shotType = this.statTypesByName.get('shot')!

    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      const players = playersByTeam.get(teamId) ?? []
      if (players.length === 0) continue

      const passCount = Math.floor(Math.random() * 26) + 20
      const shotCount = Math.floor(Math.random() * 7) + 4

      for (let index = 0; index < passCount; index++) {
        const player = players[Math.floor(Math.random() * players.length)]!
        await Stat.create({
          gameId: game.id,
          leagueId: game.leagueId,
          seasonId: game.seasonId,
          playerId: player.id,
          teamId,
          statTypeId: passType.id,
          minute: Math.floor(Math.random() * 90) + 1,
          numericValue: 1,
          value: null,
          qualifiers: { completed: Math.random() < 0.78 },
          isStoppageTime: false,
        })
      }

      for (let index = 0; index < shotCount; index++) {
        const player = players[Math.floor(Math.random() * players.length)]!
        await Stat.create({
          gameId: game.id,
          leagueId: game.leagueId,
          seasonId: game.seasonId,
          playerId: player.id,
          teamId,
          statTypeId: shotType.id,
          minute: Math.floor(Math.random() * 90) + 1,
          numericValue: 1,
          value: null,
          qualifiers: { on_target: Math.random() < 0.42 },
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

  private rosterPositionForIndex(index: number): 'attack' | 'defence' | 'midfield' | 'goalkeeper' {
    if (index === 0) {
      return 'goalkeeper'
    }

    const outfield = ['defence', 'midfield', 'attack'] as const
    return outfield[(index - 1) % outfield.length]!
  }

  /** Strips diacritics before slugifying so accented names don't leave stray dots. */
  private socialHandleSlug(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
  }

  /** A minority of outfield players carry a secondary position, like real squads. */
  private secondaryPositionFor(index: number, primary: PlayerPosition): PlayerPosition | null {
    if (primary === 'goalkeeper' || index % 4 !== 3) {
      return null
    }

    const outfield: PlayerPosition[] = ['defence', 'midfield', 'attack']
    const primaryIndex = outfield.indexOf(primary)
    return outfield[(primaryIndex + 1) % outfield.length]!
  }

  private async seedHighlightsForPlayer(player: Player) {
    const count = 1 + (player.id % 2)
    const rows = Array.from({ length: count }, (_, i) => ({
      playerId: player.id,
      videoId: this.syntheticVideoId(player.id, i),
      title: HIGHLIGHT_TITLES[(player.id + i) % HIGHLIGHT_TITLES.length]!,
      sortOrder: i,
    }))

    await PlayerHighlight.createMany(rows)
  }

  /**
   * 11-char IDs matching the real YouTube video ID shape, derived from the
   * player's own id so they're unique across the whole dataset by
   * construction — no shared counter to keep in sync.
   */
  private syntheticVideoId(playerId: number, index: number): string {
    return (playerId * 10 + index).toString(36).padStart(11, 'a')
  }
}
