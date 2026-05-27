import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import Team from '#models/team'
import { avatarInitialsFromName, formatPlayerPosition } from '#helpers/player_format'

export type CountryDetailStats = {
  leagues: number
  teams: number
  players: number
  liveMatches: number
}

export type CountryDetailFeaturedPlayer = {
  player: {
    id: string
    name: string
    avatarInitials: string
    position: string | null
    teamId: string | null
    countryCode: string
  }
  goals: number
  assists: number
  appearances: number
  yellowCards: number
  redCards: number
}

export type CountryDetailResult = {
  country: Country
  stats: CountryDetailStats
  leagues: League[]
  teams: Team[]
  featuredPlayers: CountryDetailFeaturedPlayer[]
  recentMatches: Game[]
}

type FeaturedStatRow = {
  player_id: number
  goals: string | number
  assists: string | number
  appearances: string | number
  yellow_cards: string | number
  red_cards: string | number
}

export default class CountryService {
  async resolveCountry(idOrCode: string): Promise<Country> {
    const trimmed = idOrCode.trim()
    if (!trimmed) {
      throw new Exception('Country id or code is required', { status: 400 })
    }

    const asId = Number(trimmed)
    if (Number.isFinite(asId) && asId > 0 && String(asId) === trimmed) {
      return Country.findOrFail(asId)
    }

    const country = await Country.query()
      .whereRaw('LOWER(code) = ?', [trimmed.toLowerCase()])
      .first()

    if (!country) {
      throw new Exception('Country not found', { status: 404 })
    }

    return country
  }

  async getCountryDetail(idOrCode: string): Promise<CountryDetailResult> {
    const country = await this.resolveCountry(idOrCode)

    const [stats, leagues, teams, featuredPlayers, recentMatches] = await Promise.all([
      this.loadStats(country.id),
      League.query().where('country_id', country.id).preload('country').orderBy('name', 'asc'),
      Team.query()
        .whereHas('league', (leagueQuery) => leagueQuery.where('country_id', country.id))
        .orderBy('name', 'asc')
        .select('id', 'name', 'logo_url', 'league_id'),
      this.loadFeaturedPlayers(country),
      this.loadRecentMatches(country.id),
    ])

    return { country, stats, leagues, teams, featuredPlayers, recentMatches }
  }

  private async loadRecentMatches(countryId: number): Promise<Game[]> {
    const games = await Game.query()
      .whereHas('league', (leagueQuery) => leagueQuery.where('country_id', countryId))
      .preload('homeTeam')
      .preload('awayTeam')
      .preload('league', (leagueQuery) => leagueQuery.preload('country'))
      .orderBy('played_at', 'desc')
      .limit(10)

    if (games.length === 0) {
      return games
    }

    const matchdayRows = (await db
      .from('games as current_game')
      .whereIn(
        'current_game.id',
        games.map((game) => game.id)
      )
      .select('current_game.id')
      .select(
        db.raw(`(
          select count(*)
          from games as season_game
          where season_game.season_id = current_game.season_id
            and season_game.played_at <= current_game.played_at
        ) as matchday`)
      )) as { id: number; matchday: string | number }[]

    const matchdayByGameId = new Map(matchdayRows.map((row) => [row.id, Number(row.matchday)]))

    for (const game of games) {
      const matchday = matchdayByGameId.get(game.id)
      game.$extras.matchday = matchday ?? null
    }

    return games
  }

  private async loadStats(countryId: number): Promise<CountryDetailStats> {
    const [leagues, teams, players, liveMatches] = await Promise.all([
      League.query().where('country_id', countryId).count('* as total'),
      Team.query()
        .whereHas('league', (leagueQuery) => leagueQuery.where('country_id', countryId))
        .count('* as total'),
      Player.query().where('country_id', countryId).count('* as total'),
      Game.query()
        .where('status', 'live')
        .whereHas('league', (leagueQuery) => leagueQuery.where('country_id', countryId))
        .count('* as total'),
    ])

    return {
      leagues: Number(leagues[0].$extras.total),
      teams: Number(teams[0].$extras.total),
      players: Number(players[0].$extras.total),
      liveMatches: Number(liveMatches[0].$extras.total),
    }
  }

  private async loadFeaturedPlayers(country: Country): Promise<CountryDetailFeaturedPlayer[]> {
    const rows = (await db
      .from('stats')
      .innerJoin('leagues', 'stats.league_id', 'leagues.id')
      .innerJoin('stat_types', 'stats.stat_type_id', 'stat_types.id')
      .where('leagues.country_id', country.id)
      .groupBy('stats.player_id')
      .select('stats.player_id')
      .select(
        db.raw(`sum(case when stat_types.name = 'goals' then 1 else 0 end) as goals`),
        db.raw(`sum(case when stat_types.name = 'assists' then 1 else 0 end) as assists`),
        db.raw('count(distinct stats.game_id) as appearances'),
        db.raw(`sum(case when stat_types.name = 'yellow_card' then 1 else 0 end) as yellow_cards`),
        db.raw(`sum(case when stat_types.name = 'red_card' then 1 else 0 end) as red_cards`)
      )
      .orderBy('goals', 'desc')
      .orderBy('assists', 'desc')
      .limit(10)) as FeaturedStatRow[]

    if (rows.length === 0) {
      return []
    }

    const playerIds = rows.map((row) => row.player_id)
    const leagueIds = await League.query().where('country_id', country.id).select('id')
    const leagueIdList = leagueIds.map((league) => league.id)

    const [players, memberships] = await Promise.all([
      Player.query().whereIn('id', playerIds),
      leagueIdList.length > 0
        ? LeaguePlayer.query()
            .whereIn('player_id', playerIds)
            .whereIn('league_id', leagueIdList)
            .where('status', 'active')
            .orderBy('joined_at', 'desc')
        : [],
    ])

    const playersById = new Map(players.map((player) => [player.id, player]))
    const membershipByPlayerId = new Map<number, LeaguePlayer>()
    for (const membership of memberships) {
      if (!membershipByPlayerId.has(membership.playerId)) {
        membershipByPlayerId.set(membership.playerId, membership)
      }
    }

    return rows
      .map((row) => {
        const player = playersById.get(row.player_id)
        if (!player) {
          return null
        }

        const membership = membershipByPlayerId.get(player.id)

        return {
          player: {
            id: String(player.id),
            name: player.name ?? 'Unknown',
            avatarInitials: avatarInitialsFromName(player.name),
            position: formatPlayerPosition(membership?.position),
            teamId: membership?.teamId ? String(membership.teamId) : null,
            countryCode: country.code,
          },
          goals: Number(row.goals),
          assists: Number(row.assists),
          appearances: Number(row.appearances),
          yellowCards: Number(row.yellow_cards),
          redCards: Number(row.red_cards),
        }
      })
      .filter((row): row is CountryDetailFeaturedPlayer => row !== null)
  }
}
