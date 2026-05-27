import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime, IANAZone } from 'luxon'

import Country from '#models/country'
import League from '#models/league'
import Season from '#models/season'
import StatType from '#models/stat_type'
import Team from '#models/team'

export type CreateLeagueInput = {
  name: string
  description?: string | null
  gender?: string | null
  logoUrl?: string | null
  countryId: number
  seasonName: string
  teams?: { name: string; logoUrl?: string | null }[]
}

/** UTC bounds for games that fall on a calendar day in the user's IANA timezone. */
export type MatchDayWindow = {
  playedAtStartUtc: string
  playedAtEndUtc: string
  gameStatus?: string
}

export default class LeagueService {
  async createWithSeason(
    ownerId: number,
    input: CreateLeagueInput
  ): Promise<{ league: League; season: Season; teams: Team[] }> {
    return await db.transaction(async (trx) => {
      const league = await League.create(
        {
          userId: ownerId,
          name: input.name,
          description: input.description ?? null,
          gender: input.gender ?? null,
          logoUrl: input.logoUrl ?? null,
          countryId: input.countryId,
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

      return { league, season, teams }
    })
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
    console.log('Listing leagues with filters', {
      countryId,
      gameStatus,
      gameDate,
      timeZone,
      userId,
    })
    const window: MatchDayWindow = {
      ...this.resolveMatchDayWindow(gameDate, timeZone),
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
          .if(userId, (query) => query.orderByRaw('is_favourited desc, favourites_count desc'))
          .if(!userId, (query) => query.orderByRaw('favourites_count desc'))
          .preload('games', (gameQuery) => {
            this.applyMatchDayFilters(gameQuery, window)
            gameQuery.preload('homeTeam').preload('awayTeam')
          })
          .select('leagues.id', 'leagues.name', 'leagues.logo_url')
      })
      .orderBy('name', 'asc')
  }

  async listCountriesWithLeagues(countryId?: number): Promise<Country[]> {
    return Country.query()
      .if(countryId, (query) => query.where('id', countryId as number))
      .has('leagues')
      .preload('leagues', (leagueQuery) =>
        leagueQuery
          .select('name', 'id', 'logo_url')
          .withAggregate('favouritedBy', (favQuery) => {
            favQuery.count('*').as('favourites_count')
          })
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

    const [season, statTypes] = await Promise.all([
      Season.query()
        .where('id', selectedSeasonId)
        .where('league_id', leagueId)
        .preload('league')
        .preload('games', (gamesQuery) => {
          gamesQuery.preload('homeTeam').preload('awayTeam').orderBy('played_at', 'asc')
        })
        .preload('standings', (standingsQuery) => {
          standingsQuery
            .preload('team')
            .orderBy('points', 'desc')
            .orderBy('goal_difference', 'desc')
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

    return { playedAtStartUtc, playedAtEndUtc }
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
    },
    { playedAtStartUtc, playedAtEndUtc, gameStatus }: MatchDayWindow
  ) {
    query.where('played_at', '>=', playedAtStartUtc)
    query.where('played_at', '<=', playedAtEndUtc)

    if (gameStatus) {
      query.where('status', '=', gameStatus)
    }
  }
}
