import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import env from '#start/env'

import Country from '#models/country'
import FavouriteLeague from '#models/favourite_league'
import Formation from '#models/formation'
import Game from '#models/game'
import GameLineup from '#models/game_lineup'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import PlayerHighlight from '#models/player_highlight'
import Season from '#models/season'
import Stage from '#models/stage'
import Standing from '#models/standing'
import Stat from '#models/stat'
import StatType from '#models/stat_type'
import Team from '#models/team'
import Tie from '#models/tie'
import User from '#models/user'
import Venue from '#models/venue'

import db from '@adonisjs/lucid/services/db'
import BracketService from '#services/bracket_service'
import GroupStageService, { circleMethodFixtures } from '#services/group_stage_service'
import QualifierService from '#services/qualifier_service'
import StageService from '#services/stage_service'
import StageStandingService from '#services/stage_standing_service'
import StandingService from '#services/standing_service'
import StatService from '#services/stat_service'
import TieResolver from '#services/tie_resolver'

import type { FormationSlot } from '#types/formation'
import type { PlayerPosition, PreferredFoot } from '#types/player'
import { footballerName, teamLogoUrl } from '../data/seed_footballers.js'

const DEMO_LEAGUE_NAME = 'Sportykore Demo League'
const DEMO_CUP_NAME = 'Sportykore Demo Cup'
const SHARED_CLUB_NAME = 'Riverside Athletic'
const DEFAULT_FORMATION = '4-3-3'
const PLAYERS_PER_TEAM = 12

const LEAGUE_TEAM_NAMES = [
  SHARED_CLUB_NAME,
  'Harbor FC',
  'Milltown United',
  'Oakwood Rovers',
  'Cedar Creek',
  'Northside Wanderers',
  'Bridgeview City',
  'Summit Athletic',
] as const

const CUP_TEAM_NAMES = [
  SHARED_CLUB_NAME,
  'Harbor FC',
  'Milltown United',
  'Oakwood Rovers',
  'Lakeside Town',
  'East End FC',
  'Valley Rangers',
  'Parkside United',
] as const

const POSITIONS: PlayerPosition[] = [
  'goalkeeper',
  'defence',
  'defence',
  'defence',
  'defence',
  'midfield',
  'midfield',
  'midfield',
  'midfield',
  'attack',
  'attack',
  'attack',
]

const FEET: PreferredFoot[] = ['right', 'right', 'left', 'both']

/** Stable public football highlight clips (YouTube video IDs). */
const HIGHLIGHT_CLIPS = [
  { videoId: 'YzSLAA76oyo', title: 'Match-winning strike' },
  { videoId: 'l3w2MTXBebg', title: 'Season highlights' },
] as const

type TeamBundle = {
  team: Team
  players: Player[]
}

export default class DemoSeeder extends BaseSeeder {
  private nameIndex = 0
  private statService = new StatService()
  private standingService = new StandingService()
  private stageStandingService = new StageStandingService()
  private stageService = new StageService()
  private groupStageService = new GroupStageService()
  private qualifierService = new QualifierService()
  private tieResolver = new TieResolver()
  private bracketService = new BracketService(this.stageService, this.tieResolver)
  private goalsType!: StatType
  private assistType!: StatType
  private yellowType!: StatType
  private formation!: Formation
  private formationSlots: FormationSlot[] = []
  private country!: Country

  async run() {
    if (env.get('NODE_ENV') === 'production' && env.get('ALLOW_DEMO_SEED') !== true) {
      throw new Error(
        'DemoSeeder blocked in production. Set ALLOW_DEMO_SEED=true to run intentionally.'
      )
    }

    const adminEmail = env.get('REVIEW_ADMIN_EMAIL')
    const playerEmail = env.get('REVIEW_PLAYER_EMAIL')
    if (!adminEmail || !playerEmail) {
      throw new Error(
        'DemoSeeder requires REVIEW_ADMIN_EMAIL and REVIEW_PLAYER_EMAIL so accounts match the OTP bypass.'
      )
    }

    this.country = await Country.firstOrCreate(
      { code: 'ng' },
      { name: 'Nigeria', code: 'ng' }
    )
    this.formation = await Formation.findByOrFail('name', DEFAULT_FORMATION)
    this.formationSlots = this.parseSlots(this.formation)
    this.goalsType = await StatType.query().where('name', 'goals').firstOrFail()
    this.assistType = await StatType.query().where('name', 'assists').firstOrFail()
    this.yellowType = await StatType.query().where('name', 'yellow_card').firstOrFail()

    const admin = await User.updateOrCreate(
      { email: adminEmail },
      { email: adminEmail, fullName: 'Review Admin' }
    )
    const reviewUser = await User.updateOrCreate(
      { email: playerEmail },
      { email: playerEmail, fullName: 'Jordan Okoye' }
    )

    await this.ensurePlayerProfile(admin, {
      name: 'Review Admin',
      bio: 'League organiser for the Sportykore demo competitions.',
      primaryPosition: 'midfield',
      preferredFoot: 'right',
      heightCm: 178,
      city: 'Lagos',
      state: 'Lagos',
      nationality: 'Nigerian',
      full: false,
    })

    const reviewPlayer = await this.ensurePlayerProfile(reviewUser, {
      name: 'Jordan Okoye',
      bio: 'Attacking midfielder for Riverside Athletic. Quick on the turn, clinical from the spot.',
      primaryPosition: 'midfield',
      secondaryPosition: 'attack',
      preferredFoot: 'right',
      heightCm: 176,
      city: 'Ibadan',
      state: 'Oyo',
      nationality: 'Nigerian',
      full: true,
    })

    await this.ensureHighlights(reviewPlayer.id)

    const league = await this.seedDemoLeague(admin, reviewPlayer)
    const cup = await this.seedDemoCup(admin, reviewPlayer)

    for (const user of [admin, reviewUser]) {
      for (const competition of [league, cup]) {
        await FavouriteLeague.updateOrCreate(
          { userId: user.id, leagueId: competition.id },
          { userId: user.id, leagueId: competition.id }
        )
      }
    }

    // Verify standings compute from games (do not hand-write rows)
    const leagueSeason = await Season.query()
      .where('league_id', league.id)
      .where('status', 'active')
      .firstOrFail()
    const rrStage = await Stage.query()
      .where('season_id', leagueSeason.id)
      .where('stage_type', 'round_robin')
      .firstOrFail()
    const table = await this.stageStandingService.forStage(rrStage.id)
    if (table.tables.length === 0 || table.tables[0]!.rows.length < 8) {
      throw new Error('Demo League standings did not populate as expected')
    }

    console.log(
      `DemoSeeder complete: "${DEMO_LEAGUE_NAME}" + "${DEMO_CUP_NAME}" for ${adminEmail} / ${playerEmail}`
    )
  }

  private async seedDemoLeague(admin: User, reviewPlayer: Player): Promise<League> {
    const league = await League.updateOrCreate(
      { name: DEMO_LEAGUE_NAME },
      {
        name: DEMO_LEAGUE_NAME,
        userId: admin.id,
        countryId: this.country.id,
        description:
          'Demo data for App Store / Play Store review. Partly played round-robin season with a live table.',
        gender: 'mixed',
      }
    )

    const season = await Season.updateOrCreate(
      { leagueId: league.id, name: '2026 Demo Season' },
      { leagueId: league.id, name: '2026 Demo Season', status: 'active' }
    )

    const stage = await this.stageService.ensureRoundRobinStage(season.id)
    const venues = await this.ensureVenues(league, admin.id)
    const bundles = await this.ensureTeamsWithRosters(
      league,
      season,
      admin,
      LEAGUE_TEAM_NAMES,
      reviewPlayer,
      'league'
    )

    await this.standingService.ensureForTeams(
      league.id,
      season.id,
      bundles.map((b) => b.team.id)
    )

    const existingGames = await Game.query().where('stage_id', stage.id).limit(1)
    if (existingGames.length === 0) {
      await this.seedRoundRobinFixtures(league, season, stage, bundles, venues, reviewPlayer)
    }

    for (const bundle of bundles) {
      await this.standingService.recalculate(season.id, bundle.team.id)
    }

    return league
  }

  private async seedDemoCup(admin: User, reviewPlayer: Player): Promise<League> {
    const league = await League.updateOrCreate(
      { name: DEMO_CUP_NAME },
      {
        name: DEMO_CUP_NAME,
        userId: admin.id,
        countryId: this.country.id,
        description:
          'Demo cup for store review: completed group stage into knockout, including a penalty shootout.',
        gender: 'mixed',
      }
    )

    const season = await Season.updateOrCreate(
      { leagueId: league.id, name: '2026 Demo Cup' },
      { leagueId: league.id, name: '2026 Demo Cup', status: 'active' }
    )

    const venues = await this.ensureVenues(league, admin.id)
    const bundles = await this.ensureTeamsWithRosters(
      league,
      season,
      admin,
      CUP_TEAM_NAMES,
      reviewPlayer,
      'cup'
    )

    let groupStage = await Stage.query()
      .where('season_id', season.id)
      .where('stage_type', 'group')
      .first()

    const audit = { leagueId: league.id, actorId: admin.id }

    if (!groupStage) {
      const created = await this.groupStageService.createGroupStage(
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
        audit
      )
      groupStage = created.stage

      await this.groupStageService.assignTeams(
        groupStage.id,
        { mode: 'auto', teamIds: bundles.map((b) => b.team.id), shuffle: false },
        audit
      )
      await this.groupStageService.generateGroupFixtures(groupStage.id, audit)
    }

    const groupGames = await Game.query().where('stage_id', groupStage.id)
    const incomplete = groupGames.filter((g) => g.status !== 'full_time')
    if (incomplete.length > 0 || groupGames.length === 0) {
      // Fresh fixtures are scheduled — complete all of them
      const toPlay = groupGames.length > 0 ? groupGames : await Game.query().where('stage_id', groupStage.id)
      let gameIndex = 0
      for (const game of toPlay) {
        if (game.status === 'full_time') {
          continue
        }
        if (!game.venueId) {
          game.venueId = venues[gameIndex % venues.length]!.id
          await game.save()
        }
        await this.playCompletedGame(game, bundles, reviewPlayer, {
          homeGoals: (gameIndex % 3) + 1,
          awayGoals: gameIndex % 2,
          includePenaltyGoal: gameIndex === 0,
          withLineup: true,
          daysAgo: 20 - gameIndex,
        })
        gameIndex += 1
      }
    }

    let knockout = await Stage.query()
      .where('season_id', season.id)
      .where('stage_type', 'knockout')
      .first()

    if (!knockout) {
      const result = await this.qualifierService.generateKnockout(
        groupStage.id,
        { name: 'Knockout', targetRound: 'sf' },
        audit
      )
      knockout = result.stage
    }

    await this.seedKnockoutProgress(knockout, bundles, venues, reviewPlayer)

    // StandingService.ensureRoundRobinStage can leave an unused RR shell on cup seasons;
    // remove it so the cup only shows group + knockout.
    const orphanRr = await Stage.query()
      .where('season_id', season.id)
      .where('stage_type', 'round_robin')
    for (const stage of orphanRr) {
      const games = await Game.query().where('stage_id', stage.id).limit(1)
      if (games.length === 0) {
        await Standing.query().where('stage_id', stage.id).delete()
        await stage.delete()
      }
    }

    return league
  }

  private async seedKnockoutProgress(
    knockout: Stage,
    bundles: TeamBundle[],
    venues: Venue[],
    reviewPlayer: Player
  ) {
    const sfTies = await Tie.query()
      .where('stage_id', knockout.id)
      .where('round', 'sf')
      .where('is_bye', false)
      .orderBy('bracket_position', 'asc')

    if (sfTies.length === 0) {
      return
    }

    // Complete first SF on penalties, second SF normally, then generate final and leave it pending
    for (const [index, tie] of sfTies.entries()) {
      const game = await Game.query().where('tie_id', tie.id).first()
      if (!game || game.status === 'full_time') {
        continue
      }

      game.venueId = venues[index % venues.length]!.id
      await game.save()

      if (index === 0) {
        await this.playPenaltyTie(game, bundles, reviewPlayer, 14 - index)
      } else {
        await this.playCompletedGame(game, bundles, reviewPlayer, {
          homeGoals: 2,
          awayGoals: 1,
          includePenaltyGoal: false,
          withLineup: true,
          daysAgo: 10 - index,
        })
      }
    }

    const finalExists = await Tie.query()
      .where('stage_id', knockout.id)
      .where('round', 'final')
      .first()

    if (!finalExists) {
      const allSfDone = (
        await Tie.query().where('stage_id', knockout.id).where('round', 'sf').where('is_bye', false)
      ).every((t) => t.status === 'completed' || t.winnerTeamId !== null)

      // Re-check via games
      const sfGames = await Game.query()
        .whereIn(
          'tie_id',
          sfTies.map((t) => t.id)
        )
        .where('status', 'full_time')

      if (sfGames.length >= sfTies.length) {
        try {
          await this.bracketService.generateNextRound(knockout.id, 'sf')
        } catch {
          // Idempotent: final may already exist from a partial prior run
        }
      } else if (allSfDone) {
        try {
          await this.bracketService.generateNextRound(knockout.id, 'sf')
        } catch {
          // ignore
        }
      }
    }
  }

  private async seedRoundRobinFixtures(
    league: League,
    season: Season,
    stage: Stage,
    bundles: TeamBundle[],
    venues: Venue[],
    reviewPlayer: Player
  ) {
    const teamIds = bundles.map((b) => b.team.id)
    const fixtures = circleMethodFixtures(teamIds)
    const completeThrough = Math.floor(fixtures.length * 0.65)
    console.log(`[DemoSeeder] RR fixtures: ${fixtures.length} total, completing ${completeThrough}`)

    for (const [index, fixture] of fixtures.entries()) {
      const playedAt =
        index < completeThrough
          ? DateTime.utc().minus({ days: completeThrough - index + 1 }).set({ hour: 15 })
          : DateTime.utc().plus({ days: index - completeThrough + 2 }).set({ hour: 15 })

      const game = await Game.create({
        leagueId: league.id,
        seasonId: season.id,
        stageId: stage.id,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0,
        playedAt,
        venueId: index % 3 === 2 ? null : venues[index % venues.length]!.id,
        venueName: null,
      })

      if (index >= completeThrough) {
        continue
      }

      if (index % 5 === 0) {
        console.log(`[DemoSeeder] Completing RR game ${index + 1}/${completeThrough}`)
      }

      const homeGoals = (index % 4) + (index % 2)
      const awayGoals = (index + 1) % 3
      await this.playCompletedGame(game, bundles, reviewPlayer, {
        homeGoals: Math.min(homeGoals, 4),
        awayGoals: Math.min(awayGoals, 3),
        includePenaltyGoal: index === 1,
        withLineup: index < 6,
        daysAgo: completeThrough - index + 1,
        preferReviewerGoals: fixture.homeTeamId === bundles[0]!.team.id ||
          fixture.awayTeamId === bundles[0]!.team.id,
      })
    }
  }

  private async playCompletedGame(
    game: Game,
    bundles: TeamBundle[],
    reviewPlayer: Player,
    opts: {
      homeGoals: number
      awayGoals: number
      includePenaltyGoal: boolean
      withLineup: boolean
      daysAgo: number
      preferReviewerGoals?: boolean
    }
  ) {
    await game.refresh()
    if (game.status === 'full_time') {
      return
    }

    const homeBundle = bundles.find((b) => b.team.id === game.homeTeamId)!
    const awayBundle = bundles.find((b) => b.team.id === game.awayTeamId)!

    if (opts.withLineup) {
      await this.seedLineups(game, homeBundle, awayBundle)
    }

    game.playedAt = DateTime.utc().minus({ days: opts.daysAgo }).set({ hour: 15 })
    game.status = 'second_half'
    game.firstHalfStartedAt = game.playedAt
    game.secondHalfStartedAt = game.playedAt.plus({ hours: 1 })
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45
    game.homeScore = 0
    game.awayScore = 0
    await game.save()

    let penaltyUsed = false
    for (let g = 0; g < opts.homeGoals; g++) {
      const scorer = this.pickScorer(homeBundle, reviewPlayer, Boolean(opts.preferReviewerGoals) && g === 0)
      const isPenalty = opts.includePenaltyGoal && !penaltyUsed && g === 0
      if (isPenalty) {
        penaltyUsed = true
      }
      const assist =
        !isPenalty && homeBundle.players.length > 1
          ? (homeBundle.players.find((p) => p.id !== scorer.id) ?? null)
          : null
      await this.recordGoal(game, 'home', scorer, {
        minute: 12 + g * 8,
        isPenalty,
        assistPlayerId: assist?.id ?? null,
      })
    }

    for (let g = 0; g < opts.awayGoals; g++) {
      const scorer = this.pickScorer(awayBundle, reviewPlayer, false)
      await this.recordGoal(game, 'away', scorer, {
        minute: 20 + g * 10,
        isPenalty: false,
        assistPlayerId: null,
      })
    }

    const yellowPlayerId = homeBundle.players[1]?.id ?? homeBundle.players[0]!.id
    await this.statService.validateForCreate({
      gameId: game.id,
      playerId: yellowPlayerId,
      leagueId: game.leagueId,
      seasonId: game.seasonId,
      teamId: game.homeTeamId,
      statTypeId: this.yellowType.id,
      minute: 55,
      numericValue: 1,
    })
    await Stat.create({
      gameId: game.id,
      playerId: yellowPlayerId,
      leagueId: game.leagueId,
      seasonId: game.seasonId,
      teamId: game.homeTeamId,
      statTypeId: this.yellowType.id,
      minute: 55,
      numericValue: 1,
    })

    await this.finishGame(game)
  }

  private async playPenaltyTie(
    game: Game,
    bundles: TeamBundle[],
    reviewPlayer: Player,
    daysAgo: number
  ) {
    await game.refresh()
    if (game.status === 'full_time') {
      return
    }

    const homeBundle = bundles.find((b) => b.team.id === game.homeTeamId)!
    const awayBundle = bundles.find((b) => b.team.id === game.awayTeamId)!
    await this.seedLineups(game, homeBundle, awayBundle)

    game.playedAt = DateTime.utc().minus({ days: daysAgo }).set({ hour: 18 })
    game.status = 'second_half'
    game.firstHalfStartedAt = game.playedAt
    game.secondHalfStartedAt = game.playedAt.plus({ hours: 1 })
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45
    game.homeScore = 0
    game.awayScore = 0
    await game.save()

    for (const side of ['home', 'away'] as const) {
      const bundle = side === 'home' ? homeBundle : awayBundle
      const scorer = this.pickScorer(bundle, reviewPlayer, side === 'home')
      await this.recordGoal(game, side, scorer, {
        minute: side === 'home' ? 34 : 71,
        isPenalty: side === 'home',
        assistPlayerId: null,
      })
    }

    await game.refresh()
    game.homePenaltyScore = 5
    game.awayPenaltyScore = 4
    game.winnerTeamId = game.homeTeamId
    game.status = 'full_time'
    await game.save()

    if (game.tieId) {
      await this.tieResolver.advanceTie(game.tieId)
    }
  }

  /**
   * Atomic score + accredited goal (mirrors GameScoreService.increment + accredit).
   * Done in-process without Transmit broadcasts so seeders don't stall on Redis.
   */
  private async recordGoal(
    game: Game,
    side: 'home' | 'away',
    scorer: Player,
    opts: { minute: number; isPenalty: boolean; assistPlayerId: number | null }
  ) {
    await db.transaction(async (trx) => {
      const locked = await Game.query({ client: trx }).where('id', game.id).firstOrFail()
      if (side === 'home') {
        locked.homeScore = (locked.homeScore ?? 0) + 1
      } else {
        locked.awayScore = (locked.awayScore ?? 0) + 1
      }
      locked.useTransaction(trx)
      await locked.save()

      const teamId = side === 'home' ? locked.homeTeamId : locked.awayTeamId
      await Stat.create(
        {
          gameId: locked.id,
          leagueId: locked.leagueId,
          seasonId: locked.seasonId,
          teamId,
          statTypeId: this.goalsType.id,
          playerId: scorer.id,
          minute: opts.minute,
          numericValue: 1,
          isPenalty: opts.isPenalty,
        },
        { client: trx }
      )

      if (opts.assistPlayerId) {
        await Stat.create(
          {
            gameId: locked.id,
            leagueId: locked.leagueId,
            seasonId: locked.seasonId,
            teamId,
            statTypeId: this.assistType.id,
            playerId: opts.assistPlayerId,
            relatedPlayerId: scorer.id,
            minute: opts.minute,
            numericValue: 1,
          },
          { client: trx }
        )
      }

      game.homeScore = locked.homeScore
      game.awayScore = locked.awayScore
    })
  }

  private async finishGame(game: Game) {
    await game.refresh()
    const home = game.homeScore ?? 0
    const away = game.awayScore ?? 0
    game.status = 'full_time'
    game.winnerTeamId = home === away ? null : home > away ? game.homeTeamId : game.awayTeamId
    await game.save()

    if (game.tieId) {
      await this.tieResolver.advanceTie(game.tieId)
    }
  }

  private pickScorer(bundle: TeamBundle, reviewPlayer: Player, preferReviewer: boolean): Player {
    if (preferReviewer && bundle.players.some((p) => p.id === reviewPlayer.id)) {
      return reviewPlayer
    }
    const outfield = bundle.players.filter((p) => p.primaryPosition !== 'goalkeeper')
    return outfield[1] ?? outfield[0] ?? bundle.players[0]!
  }

  private async ensureVenues(league: League, createdBy: number): Promise<Venue[]> {
    const specs = [
      {
        name: 'Riverside Community Pitch',
        address: '12 River Road',
        city: 'Ibadan',
        capacity: 2500,
        notes: 'Main demo venue — floodlights, artificial turf.',
      },
      {
        name: 'Harbor Sports Complex',
        address: '4 Dockside Avenue',
        city: 'Lagos',
        capacity: 4000,
        notes: 'Cup ties and weekend double-headers.',
      },
    ] as const

    const venues: Venue[] = []
    for (const spec of specs) {
      const venue = await Venue.updateOrCreate(
        { leagueId: league.id, name: spec.name },
        { ...spec, leagueId: league.id, createdBy }
      )
      venues.push(venue)
    }
    return venues
  }

  private async ensureTeamsWithRosters(
    league: League,
    season: Season,
    admin: User,
    names: readonly string[],
    reviewPlayer: Player,
    namespace: 'league' | 'cup'
  ): Promise<TeamBundle[]> {
    const bundles: TeamBundle[] = []

    for (const [teamIndex, name] of names.entries()) {
      const team = await Team.updateOrCreate(
        { leagueId: league.id, name },
        {
          leagueId: league.id,
          name,
          addedBy: admin.id,
          logoUrl: teamLogoUrl(name),
        }
      )

      const players: Player[] = []

      if (name === SHARED_CLUB_NAME) {
        // Slot 0 is always the reviewer player
        await LeaguePlayer.updateOrCreate(
          {
            leagueId: league.id,
            seasonId: season.id,
            playerId: reviewPlayer.id,
          },
          {
            leagueId: league.id,
            seasonId: season.id,
            playerId: reviewPlayer.id,
            teamId: team.id,
            joinedAt: DateTime.utc().minus({ months: 6 }),
            jerseyNumber: '10',
            isCaptain: true,
            status: 'active',
            position: 'midfield',
          }
        )
        players.push(reviewPlayer)

        for (let p = 1; p < PLAYERS_PER_TEAM; p++) {
          const player = await this.createFillerPlayer(admin, namespace, teamIndex, p, name)
          await LeaguePlayer.updateOrCreate(
            {
              leagueId: league.id,
              seasonId: season.id,
              playerId: player.id,
            },
            {
              leagueId: league.id,
              seasonId: season.id,
              playerId: player.id,
              teamId: team.id,
              joinedAt: DateTime.utc().minus({ months: 4 }),
              jerseyNumber: String(p + 1),
              isCaptain: false,
              status: 'active',
              position: POSITIONS[p]!,
            }
          )
          players.push(player)
        }
      } else {
        for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
          const player = await this.createFillerPlayer(admin, namespace, teamIndex, p, name)
          await LeaguePlayer.updateOrCreate(
            {
              leagueId: league.id,
              seasonId: season.id,
              playerId: player.id,
            },
            {
              leagueId: league.id,
              seasonId: season.id,
              playerId: player.id,
              teamId: team.id,
              joinedAt: DateTime.utc().minus({ months: 3 }),
              jerseyNumber: String(p + 1),
              isCaptain: p === 0,
              status: 'active',
              position: POSITIONS[p]!,
            }
          )
          players.push(player)
        }
      }

      bundles.push({ team, players })
    }

    return bundles
  }

  private async createFillerPlayer(
    admin: User,
    namespace: string,
    teamIndex: number,
    playerIndex: number,
    teamName: string
  ): Promise<Player> {
    const email = `demo.${namespace}.t${teamIndex}.p${playerIndex}@sportykore.demo`
    const displayName = footballerName(this.nameIndex++)
    const user = await User.updateOrCreate(
      { email },
      { email, fullName: displayName }
    )

    const primaryPosition = POSITIONS[playerIndex] ?? 'midfield'
    return Player.updateOrCreate(
      { userId: user.id },
      {
        userId: user.id,
        addedBy: admin.id,
        countryId: this.country.id,
        name: displayName,
        bio: `${displayName} plays for ${teamName}.`,
        primaryPosition,
        preferredFoot: FEET[playerIndex % FEET.length]!,
        heightCm: 170 + (playerIndex % 20),
        dateOfBirth: DateTime.utc().minus({ years: 20 + (playerIndex % 12), days: playerIndex * 17 }),
        city: 'Lagos',
        state: 'Lagos',
        nationality: 'Nigerian',
        visibility: 'active',
      }
    )
  }

  private async ensurePlayerProfile(
    user: User,
    profile: {
      name: string
      bio: string
      primaryPosition: PlayerPosition
      secondaryPosition?: PlayerPosition
      preferredFoot: PreferredFoot
      heightCm: number
      city: string
      state: string
      nationality: string
      full: boolean
    }
  ): Promise<Player> {
    return Player.updateOrCreate(
      { userId: user.id },
      {
        userId: user.id,
        addedBy: user.id,
        countryId: this.country.id,
        name: profile.name,
        bio: profile.bio,
        primaryPosition: profile.primaryPosition,
        secondaryPosition: profile.full ? (profile.secondaryPosition ?? null) : null,
        preferredFoot: profile.preferredFoot,
        heightCm: profile.heightCm,
        dateOfBirth: DateTime.utc().minus({ years: profile.full ? 24 : 32, months: 3 }),
        city: profile.city,
        state: profile.state,
        nationality: profile.nationality,
        visibility: 'active',
      }
    )
  }

  private async ensureHighlights(playerId: number) {
    for (const [index, clip] of HIGHLIGHT_CLIPS.entries()) {
      await PlayerHighlight.updateOrCreate(
        { playerId, videoId: clip.videoId },
        {
          playerId,
          videoId: clip.videoId,
          title: clip.title,
          sortOrder: index,
        }
      )
    }
  }

  private async seedLineups(game: Game, home: TeamBundle, away: TeamBundle) {
    const existing = await GameLineup.query().where('game_id', game.id).limit(1)
    if (existing.length > 0) {
      return
    }

    await this.seedTeamLineup(game, home)
    await this.seedTeamLineup(game, away)
  }

  private async seedTeamLineup(game: Game, bundle: TeamBundle) {
    const slots = this.formationSlots
    if (bundle.players.length < slots.length) {
      return
    }

    const starters = slots.map((slot, index) => ({
      gameId: game.id,
      teamId: bundle.team.id,
      playerId: bundle.players[index]!.id,
      formationId: this.formation.id,
      slotKey: slot.key,
      position: slot.position,
      status: 'starter' as const,
      jerseyNumber: index + 1,
      startingOrder: index + 1,
    }))

    const subs = bundle.players.slice(slots.length, slots.length + 3).map((player, index) => ({
      gameId: game.id,
      teamId: bundle.team.id,
      playerId: player.id,
      formationId: this.formation.id,
      slotKey: null,
      position: null,
      status: 'substitute' as const,
      jerseyNumber: slots.length + index + 1,
      startingOrder: null,
    }))

    await GameLineup.createMany([...starters, ...subs])
  }

  private parseSlots(formation: Formation): FormationSlot[] {
    if (typeof formation.slots === 'string') {
      return JSON.parse(formation.slots) as FormationSlot[]
    }
    return formation.slots as FormationSlot[]
  }
}
