import { createHash } from 'node:crypto'

export type StandingAdjustmentInput = { teamId: number; pointsDelta: number }

export type TableRow = {
  teamId: number
  teamName: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number // after adjustments
  pointsAdjustment: number // sum of deltas
  form: string | null
  position: number
}

export type ComputeTableGame = {
  homeTeamId: number
  awayTeamId: number
  homeScore: number | null
  awayScore: number | null
}

export type TeamMeta = { id: number; name: string }

const FORM_LIMIT = 5

type MutableStats = {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  outcomes: string[]
}

function emptyStats(): MutableStats {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    outcomes: [],
  }
}

/**
 * Fixed standings comparator: points → GD → GF → team name.
 */
export function compareTableRows(
  a: Pick<TableRow, 'points' | 'goalDifference' | 'goalsFor' | 'teamName'>,
  b: Pick<TableRow, 'points' | 'goalDifference' | 'goalsFor' | 'teamName'>
): number {
  if (b.points !== a.points) {
    return b.points - a.points
  }
  if (b.goalDifference !== a.goalDifference) {
    return b.goalDifference - a.goalDifference
  }
  if (b.goalsFor !== a.goalsFor) {
    return b.goalsFor - a.goalsFor
  }
  return a.teamName.localeCompare(b.teamName)
}

/**
 * Deterministic cohort identity for override staleness checks.
 * Format: sha1(`${points}:${played}:${sortedTeamIds.join(',')}`)
 */
export function cohortSignature(points: number, played: number, teamIds: number[]): string {
  const sortedIds = [...teamIds].sort((a, b) => a - b)
  return createHash('sha1').update(`${points}:${played}:${sortedIds.join(',')}`).digest('hex')
}

/**
 * Aggregate games into a sorted table. Null scores count as 0 (kickoff draws).
 * All teams in teamMeta appear even with zero games. Scoring is 3/1/0.
 */
export function computeTable(
  games: ComputeTableGame[],
  teamMeta: TeamMeta[],
  adjustments: StandingAdjustmentInput[] = []
): TableRow[] {
  const statsByTeam = new Map<number, MutableStats>()
  const nameByTeam = new Map<number, string>()

  for (const team of teamMeta) {
    statsByTeam.set(team.id, emptyStats())
    nameByTeam.set(team.id, team.name)
  }

  for (const game of games) {
    const homeScore = game.homeScore ?? 0
    const awayScore = game.awayScore ?? 0

    for (const side of [
      { teamId: game.homeTeamId, scored: homeScore, conceded: awayScore },
      { teamId: game.awayTeamId, scored: awayScore, conceded: homeScore },
    ] as const) {
      const stats = statsByTeam.get(side.teamId)
      if (!stats) {
        continue
      }

      stats.played++
      stats.goalsFor += side.scored
      stats.goalsAgainst += side.conceded

      if (side.scored > side.conceded) {
        stats.wins++
        stats.outcomes.push('W')
      } else if (side.scored === side.conceded) {
        stats.draws++
        stats.outcomes.push('D')
      } else {
        stats.losses++
        stats.outcomes.push('L')
      }
    }
  }

  const adjustmentByTeam = new Map<number, number>()
  for (const adjustment of adjustments) {
    adjustmentByTeam.set(
      adjustment.teamId,
      (adjustmentByTeam.get(adjustment.teamId) ?? 0) + adjustment.pointsDelta
    )
  }

  const rows: TableRow[] = []
  for (const [teamId, stats] of statsByTeam) {
    const pointsAdjustment = adjustmentByTeam.get(teamId) ?? 0
    const basePoints = stats.wins * 3 + stats.draws
    rows.push({
      teamId,
      teamName: nameByTeam.get(teamId)!,
      played: stats.played,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst,
      goalDifference: stats.goalsFor - stats.goalsAgainst,
      points: basePoints + pointsAdjustment,
      pointsAdjustment,
      form: stats.outcomes.length > 0 ? stats.outcomes.slice(-FORM_LIMIT).join(',') : null,
      position: 0,
    })
  }

  rows.sort(compareTableRows)

  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
  }))
}
