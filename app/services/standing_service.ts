import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Standing from '#models/standing'
import Team from '#models/team'
import { sortStandingsByTiebreaker, type StandingSortRow } from '#services/standing_tiebreaker'
import { STANDING_GAME_STATUSES } from '#types/game_status'
import { DEFAULT_LEAGUE_TIEBREAKER, type LeagueTiebreaker } from '#types/tiebreaker'

const ZERO_STANDING = {
  position: 0,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
  form: null as string | null,
}

const FORM_LIMIT = 5

type TeamStandingStats = {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form: string | null
}

function computeTeamStandingStats(teamId: number, games: Game[]): TeamStandingStats {
  let played = 0
  let wins = 0
  let draws = 0
  let losses = 0
  let goalsFor = 0
  let goalsAgainst = 0
  const outcomes: string[] = []

  for (const game of games) {
    const isHome = game.homeTeamId === teamId
    const homeScore = game.homeScore ?? 0
    const awayScore = game.awayScore ?? 0
    const scored = isHome ? homeScore : awayScore
    const conceded = isHome ? awayScore : homeScore

    played++
    goalsFor += scored
    goalsAgainst += conceded

    if (scored > conceded) {
      wins++
      outcomes.push('W')
    } else if (scored === conceded) {
      draws++
      outcomes.push('D')
    } else {
      losses++
      outcomes.push('L')
    }
  }

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: wins * 3 + draws,
    form: outcomes.length > 0 ? outcomes.slice(-FORM_LIMIT).join(',') : null,
  }
}

export default class StandingService {
  /**
   * Ensure a zeroed standing row exists for a team in a season (idempotent).
   */
  async ensureForTeam(
    leagueId: number,
    seasonId: number,
    teamId: number,
    client?: TransactionClientContract
  ) {
    const options = client ? { client } : undefined

    await Standing.firstOrCreate(
      { seasonId, teamId },
      { leagueId, ...ZERO_STANDING },
      options
    )
  }

  /**
   * Seed zeroed standing rows for all teams in a season, then assign positions.
   */
  async ensureForTeams(
    leagueId: number,
    seasonId: number,
    teamIds: number[],
    client?: TransactionClientContract
  ) {
    for (const teamId of teamIds) {
      await this.ensureForTeam(leagueId, seasonId, teamId, client)
    }

    await this.recalculatePositions(seasonId, client)
  }

  /**
   * Seed zeroed standing rows for league teams missing from a season table.
   */
  async ensureLeagueTeamsInSeason(leagueId: number, seasonId: number) {
    const teams = await Team.query().where('league_id', leagueId).select('id')
    if (teams.length === 0) {
      return
    }

    const teamIds = teams.map((team) => team.id)
    const existingRows = await Standing.query()
      .where('season_id', seasonId)
      .whereIn('team_id', teamIds)
      .select('team_id')

    const existingIds = new Set(existingRows.map((row) => row.teamId))
    const missingIds = teamIds.filter((id) => !existingIds.has(id))

    if (missingIds.length > 0) {
      await this.ensureForTeams(leagueId, seasonId, missingIds)
    }
  }

  async recalculate(seasonId: number, teamId: number) {
    await db.transaction(async (trx) => {
      await this.recalculateTeam(seasonId, teamId, trx)
      await this.recalculatePositions(seasonId, trx)
    })
  }

  async recalculateForGame(seasonId: number, homeTeamId: number, awayTeamId: number) {
    await db.transaction(async (trx) => {
      await this.recalculateTeam(seasonId, homeTeamId, trx)
      await this.recalculateTeam(seasonId, awayTeamId, trx)
      await this.recalculatePositions(seasonId, trx)
    })
  }

  async recalculateTeam(
    seasonId: number,
    teamId: number,
    client?: TransactionClientContract
  ) {
    const team = await Team.query({ client }).where('id', teamId).firstOrFail()

    const games = await Game.query({ client })
      .where('season_id', seasonId)
      .where((query) => query.where('home_team_id', teamId).orWhere('away_team_id', teamId))
      .whereIn('status', [...STANDING_GAME_STATUSES])
      .orderBy('played_at', 'asc')

    const stats = computeTeamStandingStats(teamId, games)
    await Standing.updateOrCreate(
      { seasonId, teamId },
      {
        leagueId: team.leagueId,
        ...stats,
      },
      client ? { client } : undefined
    )
  }

  async recalculatePositionsForLeague(leagueId: number) {
    const activeSeason = await Season.query()
      .where('league_id', leagueId)
      .where('status', 'active')
      .select('id')
      .first()

    if (!activeSeason) {
      return
    }

    await this.recalculatePositions(activeSeason.id)
  }

  async recalculatePositions(seasonId: number, client?: TransactionClientContract) {
    const season = await Season.query({ client }).where('id', seasonId).firstOrFail()
    const league = await League.query({ client }).where('id', season.leagueId).firstOrFail()
    const tiebreaker = (league.tiebreaker ?? DEFAULT_LEAGUE_TIEBREAKER) as LeagueTiebreaker

    const standings = await Standing.query({ client }).where('season_id', seasonId)
    const games = await Game.query({ client })
      .where('season_id', seasonId)
      .whereIn('status', [...STANDING_GAME_STATUSES])

    const sorted = sortStandingsByTiebreaker(standings, tiebreaker, games)
    await this.applyPositions(sorted, client)
  }

  private async applyPositions(
    sorted: StandingSortRow[],
    client?: TransactionClientContract
  ) {
    const writePositions = async (writer: TransactionClientContract) => {
      for (const [index, standing] of sorted.entries()) {
        await writer.from('standings').where('id', standing.id).update({ position: index + 1 })
      }
    }

    if (client) {
      await writePositions(client)
      return
    }

    await db.transaction(writePositions)
  }
}
