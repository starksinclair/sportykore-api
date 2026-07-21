import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Game from '#models/game'
import Season from '#models/season'
import Standing from '#models/standing'
import StandingAdjustment from '#models/standing_adjustment'
import Team from '#models/team'
import { compareTableRows } from '#services/standings/compute_table'
import { STANDING_GAME_STATUSES } from '#types/game_status'
import StageService from '#services/stage_service'
import { inject } from '@adonisjs/core'

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

type StandingPositionRow = Pick<
  Standing,
  'id' | 'teamId' | 'points' | 'goalDifference' | 'goalsFor'
>

function computeTeamStandingStats(
  teamId: number,
  games: Game[],
  pointsAdjustment: number = 0
): TeamStandingStats {
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
    points: wins * 3 + draws + pointsAdjustment,
    form: outcomes.length > 0 ? outcomes.slice(-FORM_LIMIT).join(',') : null,
  }
}

@inject()
export default class StandingService {
  private stageService: StageService

  constructor(stageService?: StageService) {
    this.stageService = stageService ?? new StageService()
  }

  /**
   * Ensure a zeroed standing row exists for a team in a season (idempotent).
   * Safe under concurrent writers: unique (season_id, team_id) races are ignored.
   */
  async ensureForTeam(
    leagueId: number,
    seasonId: number,
    teamId: number,
    client?: TransactionClientContract
  ) {
    const options = client ? { client } : undefined
    const stage = await this.stageService.ensureRoundRobinStage(seasonId, client)

    const existing = await Standing.query(options)
      .where('season_id', seasonId)
      .where('team_id', teamId)
      .first()
    if (existing) {
      return existing
    }

    try {
      return await Standing.create(
        { seasonId, teamId, leagueId, stageId: stage.id, ...ZERO_STANDING },
        options
      )
    } catch (error) {
      // Concurrent ensureForTeam / recalculateTeam won the insert
      if (this.isUniqueConstraintError(error)) {
        return Standing.query(options)
          .where('season_id', seasonId)
          .where('team_id', teamId)
          .firstOrFail()
      }
      throw error
    }
  }

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

  async ensureLeagueTeamsInSeason(leagueId: number, seasonId: number) {
    const teams = await Team.query().where('league_id', leagueId).select('id')
    if (teams.length === 0) {
      return
    }

    const teamIds = teams.map((team) => team.id)
    const existingRows = await Standing.query()
      .where('season_id', seasonId)
      .whereIn('team_id', teamIds)

    const existingIds = new Set(existingRows.map((row) => row.teamId))
    const missingIds = teamIds.filter((id) => !existingIds.has(id))

    if (missingIds.length > 0) {
      await this.ensureForTeams(leagueId, seasonId, missingIds)
    }
  }

  /** Sums standing_adjustments for a team on a stage — folded into stored points. */
  private async sumPointsAdjustment(
    stageId: number,
    teamId: number,
    client?: TransactionClientContract
  ): Promise<number> {
    const adjustments = await StandingAdjustment.query({ client })
      .where('stage_id', stageId)
      .where('team_id', teamId)

    return adjustments.reduce((total, adjustment) => total + adjustment.pointsDelta, 0)
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }
    const message = 'message' in error ? String((error as { message: unknown }).message) : ''
    const code = 'code' in error ? String((error as { code: unknown }).code) : ''
    return (
      code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      code === '23505' ||
      /UNIQUE constraint failed/i.test(message) ||
      /duplicate key/i.test(message)
    )
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

  async recalculateTeam(seasonId: number, teamId: number, client?: TransactionClientContract) {
    const team = await Team.query({ client }).where('id', teamId).firstOrFail()
    const stage = await this.stageService.ensureRoundRobinStage(seasonId, client)

    const [games, pointsAdjustment] = await Promise.all([
      Game.query({ client })
        .where('season_id', seasonId)
        .where('stage_id', stage.id)
        .where((query) => query.where('home_team_id', teamId).orWhere('away_team_id', teamId))
        .whereIn('status', [...STANDING_GAME_STATUSES])
        .orderBy('played_at', 'asc'),
      this.sumPointsAdjustment(stage.id, teamId, client),
    ])

    const stats = computeTeamStandingStats(teamId, games, pointsAdjustment)
    const options = client ? { client } : undefined
    try {
      await Standing.updateOrCreate(
        { seasonId, teamId },
        {
          leagueId: team.leagueId,
          stageId: stage.id,
          ...stats,
        },
        options
      )
    } catch (error) {
      // Rare race with ensureForTeam inserting the same (season, team) row
      if (!this.isUniqueConstraintError(error)) {
        throw error
      }
      const row = await Standing.query(options)
        .where('season_id', seasonId)
        .where('team_id', teamId)
        .firstOrFail()
      row.merge({
        leagueId: team.leagueId,
        stageId: stage.id,
        ...stats,
      })
      await row.save()
    }
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
    const standings = await Standing.query({ client }).where('season_id', seasonId)
    if (standings.length === 0) {
      return
    }

    const teamIds = standings.map((row) => row.teamId)
    const teams = await Team.query({ client }).whereIn('id', teamIds).select('id', 'name')
    const nameByTeam = new Map(teams.map((team) => [team.id, team.name]))

    const sorted = [...standings].sort((a, b) =>
      compareTableRows(
        {
          points: a.points ?? 0,
          goalDifference: a.goalDifference ?? 0,
          goalsFor: a.goalsFor ?? 0,
          teamName: nameByTeam.get(a.teamId) ?? '',
        },
        {
          points: b.points ?? 0,
          goalDifference: b.goalDifference ?? 0,
          goalsFor: b.goalsFor ?? 0,
          teamName: nameByTeam.get(b.teamId) ?? '',
        }
      )
    )

    await this.applyPositions(sorted, client)
  }

  private async applyPositions(sorted: StandingPositionRow[], client?: TransactionClientContract) {
    const writePositions = async (writer: TransactionClientContract) => {
      for (const [index, standing] of sorted.entries()) {
        await writer
          .from('standings')
          .where('id', standing.id)
          .update({ position: index + 1 })
      }
    }

    if (client) {
      await writePositions(client)
      return
    }

    await db.transaction(writePositions)
  }
}
