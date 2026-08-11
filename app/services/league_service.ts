import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import { DateTime, IANAZone } from 'luxon'

import Country from '#models/country'
import League from '#models/league'
import Season from '#models/season'
import Stage from '#models/stage'
import StatType from '#models/stat_type'
import Team from '#models/team'
import StandingService from '#services/standing_service'
import { LIVE_GAME_STATUSES } from '#types/game_status'

import { DEFAULT_LEAGUE_TIEBREAKER, type LeagueTiebreaker } from '#types/tiebreaker'
import type { GroupStageConfig, KnockoutStageConfig } from '#types/stage'
import StageService from '#services/stage_service'
import GroupStageService from '#services/group_stage_service'

export type CompetitionFormat = 'league' | 'knockout' | 'group'

export type CreateLeagueInput = {
  name: string
  description?: string | null
  gender?: string | null
  logoUrl?: string | null
  countryId: number
  seasonName: string
  tiebreaker?: LeagueTiebreaker
  startDate?: DateTime | null
  endDate?: DateTime | null
  teams?: { name: string; logoUrl?: string | null }[]
  format?: CompetitionFormat
  knockout?: {
    name?: string
    seed?: boolean
    config: KnockoutStageConfig
  }
  group?: {
    name?: string
    config?: Partial<GroupStageConfig> | GroupStageConfig
  }
}

export type CreateCompetitionResult = {
  league: League
  season: Season
  teams: Team[]
  stage: Stage
  format: CompetitionFormat
  seeded: boolean
}

/** UTC bounds for games that fall on a calendar day in the user's IANA timezone. */
export type MatchDayWindow = {
  playedAtStartUtc: string
  playedAtEndUtc: string
  gameStatus?: string
}

/** Resolved calendar day + timezone used for match-day filtering. */
export type MatchDayContext = MatchDayWindow & {
  gameDate: string
  timeZone: string
}

@inject()
export default class LeagueService {
  constructor(
    private standingService: StandingService,
    private stageService: StageService = new StageService(),
    private groupStageService: GroupStageService = new GroupStageService()
  ) {}

  async createWithSeason(
    ownerId: number,
    input: CreateLeagueInput
  ): Promise<CreateCompetitionResult> {
    const format: CompetitionFormat = input.format ?? 'league'
    if (format === 'knockout') {
      if (!input.knockout?.config?.ties?.default?.tie_format) {
        throw new Exception('knockout.config is required when format is knockout', {
          status: 422,
        })
      }
    }

    if (format === 'knockout' && input.knockout?.config) {
      this.stageService.assertKnockoutTieConfig(input.knockout.config)
    }

    const created = await db.transaction(async (trx) => {
      const league = await League.create(
        {
          userId: ownerId,
          name: input.name,
          description: input.description ?? null,
          gender: input.gender ?? null,
          logoUrl: input.logoUrl ?? null,
          countryId: input.countryId,
          tiebreaker: input.tiebreaker ?? DEFAULT_LEAGUE_TIEBREAKER,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
        },
        { client: trx }
      )

      const season = await Season.create(
        {
          leagueId: league.id,
          name: input.seasonName,
          status: 'active',
        },
        { client: trx }
      )

      const teams = await Team.createMany(
        input.teams?.map((team) => ({
          leagueId: league.id,
          name: team.name,
          logoUrl: team.logoUrl ?? null,
          addedBy: ownerId,
        })) ?? [],
        { client: trx }
      )

      let stage: Stage
      if (format === 'knockout') {
        stage = await this.stageService.createKnockoutStage(
          league.id,
          season.id,
          {
            name: input.knockout?.name ?? 'Cup',
            config: input.knockout!.config,
          },
          trx
        )
      } else if (format === 'group') {
        const { stage: groupStage } = await this.groupStageService.createGroupStage(
          league.id,
          season.id,
          {
            name: input.group?.name ?? 'Group Stage',
            config: input.group?.config,
          },
          trx
        )
        stage = groupStage
      } else {
        stage = await this.stageService.ensureRoundRobinStage(season.id, trx)
        if (teams.length > 0) {
          await this.standingService.ensureForTeams(
            league.id,
            season.id,
            teams.map((team) => team.id),
            trx
          )
        }
      }

      return { league, season, teams, stage }
    })

    let seeded = false
    const shouldSeed =
      format === 'knockout' && (input.knockout?.seed ?? true) && created.teams.length >= 2

    if (shouldSeed) {
      const { default: BracketService } = await import('#services/bracket_service')
      const { default: TieResolver } = await import('#services/tie_resolver')
      const bracket = new BracketService(this.stageService, new TieResolver())
      await bracket.generateKnockoutPhase(
        created.stage.id,
        created.teams.map((team) => team.id)
      )
      seeded = true
      await created.stage.refresh()
    }

    // Group format never auto-assigns or generates fixtures on create
    return {
      ...created,
      format,
      seeded: format === 'group' ? false : seeded,
    }
  }

  async resortStandingsForLeague(leagueId: number) {
    await this.standingService.recalculatePositionsForLeague(leagueId)
  }

  /**
   * Countries/leagues/games for the matches feed.
   * `gameDate` is a calendar day in `timeZone` (not a UTC day). `played_at` is filtered using
   * that local day's start/end converted to UTC. See docs/TIME_AND_TIMEZONE.md.
   */
  async listLeagueByCountry(
    countryId: number | string | undefined,
    gameStatus: string | undefined,
    gameDate: string | undefined,
    timeZone: string | undefined,
    userId?: number
  ): Promise<Country[]> {
    // console.log('Listing leagues with filters', {
    //   countryId,
    //   gameStatus,
    //   gameDate,
    //   timeZone,
    //   userId,
    // })
    const window: MatchDayWindow = {
      ...this.resolveMatchDayContext(gameDate, timeZone),
      gameStatus: gameStatus || undefined,
    }
    const parsedCountryId =
      countryId !== undefined && countryId !== '' ? Number(countryId) : undefined

    if (
      parsedCountryId !== undefined &&
      (!Number.isFinite(parsedCountryId) || parsedCountryId <= 0)
    ) {
      throw new Exception('Invalid country id', { status: 400 })
    }

    return Country.query()
      .if(parsedCountryId, (query) => query.where('id', parsedCountryId!))
      .whereHas('leagues', (leagueQuery) => {
        leagueQuery.whereHas('games', (gameQuery) => this.applyMatchDayFilters(gameQuery, window))
      })
      .preload('leagues', (leagueQuery) => {
        leagueQuery
          .whereHas('games', (gameQuery) => this.applyMatchDayFilters(gameQuery, window))
          .withAggregate('favouritedBy', (favQuery) => {
            favQuery.count('*').as('favourites_count')
          })
          .if(userId, (query) =>
            query.withAggregate('favouritedBy', (favQuery) => {
              favQuery.where('favourite_leagues.user_id', userId!).count('*').as('is_favourited')
            })
          )
          .if(userId, (query) =>
            query.withAggregate('notificationPreferences', (prefQuery) => {
              prefQuery
                .where('league_notification_preferences.user_id', userId!)
                .where('league_notification_preferences.enabled', true)
                .count('*')
                .as('notifications_enabled')
            })
          )
          .if(userId, (query) => query.orderByRaw('is_favourited desc, favourites_count desc'))
          .if(!userId, (query) => query.orderByRaw('favourites_count desc'))
          .preload('games', (gameQuery) => {
            this.applyMatchDayFilters(gameQuery, window)
            gameQuery
              .preload('homeTeam')
              .preload('awayTeam')
              .preload('venue')
              .orderBy('played_at', 'asc')
          })
          .select('leagues.id', 'leagues.name', 'leagues.logo_url')
      })
      .orderBy('name', 'asc')
  }

  async listCountriesWithLeagues(countryId?: number, userId?: number): Promise<Country[]> {
    return Country.query()
      .if(countryId, (query) => query.where('id', countryId as number))
      .has('leagues')
      .preload('leagues', (leagueQuery) =>
        leagueQuery
          .select('name', 'id', 'logo_url')
          .withAggregate('favouritedBy', (favQuery) => {
            favQuery.count('*').as('favourites_count')
          })
          .if(userId, (query) =>
            query.withAggregate('favouritedBy', (favQuery) => {
              favQuery.where('favourite_leagues.user_id', userId!).count('*').as('is_favourited')
            })
          )
          .if(userId, (query) =>
            query.withAggregate('notificationPreferences', (prefQuery) => {
              prefQuery
                .where('league_notification_preferences.user_id', userId!)
                .where('league_notification_preferences.enabled', true)
                .count('*')
                .as('notifications_enabled')
            })
          )
          .orderByRaw('favourites_count desc')
      )
      .orderBy('name', 'asc')
  }

  async getLeague(
    leagueId: number,
    seasonId?: number
  ): Promise<{ seasons: Season[]; season: Season; statTypes: StatType[] }> {
    await League.findOrFail(leagueId)

    const seasons = await Season.query()
      .where('league_id', leagueId)
      .orderByRaw(
        `CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, created_at DESC`
      )
      .select('id', 'name', 'status', 'league_id')

    if (seasons.length === 0) {
      throw new Exception('League has no seasons', { status: 404 })
    }

    const selectedSeasonId = this.resolveSeasonId(seasons, seasonId)

    const roundRobinStage = await Stage.query()
      .where('season_id', selectedSeasonId)
      .where('stage_type', 'round_robin')
      .first()

    // Knockout-only seasons have no round_robin stage — don't create one for standings.
    if (roundRobinStage) {
      await this.standingService.ensureLeagueTeamsInSeason(leagueId, selectedSeasonId)
    }

    const [season, statTypes] = await Promise.all([
      Season.query()
        .where('id', selectedSeasonId)
        .where('league_id', leagueId)
        .preload('league')
        .preload('stages', (stagesQuery) => {
          stagesQuery.orderBy('sequence', 'asc').orderBy('id', 'asc')
        })
        .preload('games', (gamesQuery) => {
          gamesQuery
            .preload('homeTeam')
            .preload('awayTeam')
            .preload('venue')
            .orderBy('played_at', 'asc')
        })
        .preload('standings', (standingsQuery) => {
          standingsQuery.preload('team').orderBy('position', 'asc')
        })
        .preload('stats', (statsQuery) => {
          statsQuery.preload('type').preload('player').preload('team').preload('relatedPlayer')
        })
        .firstOrFail(),
      StatType.query().orderBy('category').orderBy('display_name'),
    ])

    return { seasons, season, statTypes }
  }

  private resolveSeasonId(seasons: Season[], seasonId?: number): number {
    if (seasonId !== undefined) {
      const match = seasons.find((row) => row.id === seasonId)
      if (!match) {
        throw new Exception('Season not found for this league', { status: 404 })
      }
      return seasonId
    }

    const activeSeason = seasons.find((row) => row.status === 'active')
    return activeSeason?.id ?? seasons[0]!.id
  }

  /**
   * Builds UTC instants for the start/end of a calendar day in the given IANA timezone.
   */
  resolveMatchDayWindow(gameDate?: string, timeZone?: string): MatchDayWindow {
    const { playedAtStartUtc, playedAtEndUtc } = this.resolveMatchDayContext(gameDate, timeZone)
    return { playedAtStartUtc, playedAtEndUtc }
  }

  /**
   * Resolves the calendar day, timezone, and UTC bounds used for match-day filtering.
   */
  resolveMatchDayContext(gameDate?: string, timeZone?: string): MatchDayContext {
    const zone = this.resolveTimeZone(timeZone)

    const day = gameDate ? DateTime.fromISO(gameDate, { zone }) : DateTime.now().setZone(zone)

    if (!day.isValid) {
      throw new Exception('Invalid gameDate. Use YYYY-MM-DD or an ISO 8601 date.', { status: 400 })
    }

    const localDay = day.startOf('day')
    const startUtc = localDay.toUTC()
    const endUtc = localDay.endOf('day').toUTC()

    const playedAtStartUtc = startUtc.toSQL({ includeOffset: false })
    const playedAtEndUtc = endUtc.toSQL({ includeOffset: false })

    if (!playedAtStartUtc || !playedAtEndUtc) {
      throw new Exception('Could not resolve match day window', { status: 500 })
    }

    return {
      gameDate: localDay.toFormat('yyyy-MM-dd'),
      timeZone: zone,
      playedAtStartUtc,
      playedAtEndUtc,
    }
  }

  private resolveTimeZone(timeZone?: string): string {
    const zone = (timeZone?.trim() || 'UTC').trim()

    if (!IANAZone.isValidZone(zone)) {
      throw new Exception(
        'Invalid timeZone. Use an IANA timezone identifier (e.g. Africa/Lagos, Europe/London).',
        { status: 400 }
      )
    }

    return zone
  }

  private applyMatchDayFilters(
    query: {
      where: (column: string, operator: string, value: string) => void
      whereIn?: (column: string, values: string[]) => void
    },
    { playedAtStartUtc, playedAtEndUtc, gameStatus }: MatchDayWindow
  ) {
    query.where('played_at', '>=', playedAtStartUtc)
    query.where('played_at', '<=', playedAtEndUtc)

    if (!gameStatus) {
      return
    }

    if (gameStatus === 'live' && query.whereIn) {
      query.whereIn('status', [...LIVE_GAME_STATUSES])
      return
    }

    query.where('status', '=', gameStatus)
  }
}
