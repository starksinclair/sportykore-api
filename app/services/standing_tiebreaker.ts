import type Game from '#models/game'
import type Standing from '#models/standing'
import {
  type LeagueTiebreaker,
  type TiebreakerCriterion,
  TIEBREAKER_PRESETS,
  h2hCriteriaFromPreset,
  isH2hCriterion,
} from '#types/tiebreaker'

export type StandingSortRow = Pick<
  Standing,
  | 'id'
  | 'teamId'
  | 'points'
  | 'wins'
  | 'goalDifference'
  | 'goalsFor'
  | 'goalsAgainst'
>

export type MiniLeagueStats = {
  points: number
  goalDifference: number
  goalsScored: number
}

export function computeAwayGoalsScored(teamId: number, games: Game[]): number {
  let total = 0

  for (const game of games) {
    if (game.awayTeamId === teamId) {
      total += game.awayScore ?? 0
    }
  }

  return total
}

export function computeMiniLeagueStats(
  teamId: number,
  groupTeamIds: number[],
  games: Game[]
): MiniLeagueStats {
  const group = new Set(groupTeamIds)
  let points = 0
  let goalsFor = 0
  let goalsAgainst = 0

  for (const game of games) {
    if (!group.has(game.homeTeamId) || !group.has(game.awayTeamId)) {
      continue
    }

    const homeScore = game.homeScore ?? 0
    const awayScore = game.awayScore ?? 0
    const isHome = game.homeTeamId === teamId
    const scored = isHome ? homeScore : awayScore
    const conceded = isHome ? awayScore : homeScore

    goalsFor += scored
    goalsAgainst += conceded

    if (scored > conceded) {
      points += 3
    } else if (scored === conceded) {
      points += 1
    }
  }

  return {
    points,
    goalDifference: goalsFor - goalsAgainst,
    goalsScored: goalsFor,
  }
}

function compareByCriterion(
  a: StandingSortRow,
  b: StandingSortRow,
  criterion: TiebreakerCriterion,
  awayGoalsByTeam: Map<number, number>
): number {
  switch (criterion) {
    case 'goal_difference':
      return (b.goalDifference ?? 0) - (a.goalDifference ?? 0)
    case 'goals_scored':
      return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
    case 'goals_conceded':
      return (a.goalsAgainst ?? 0) - (b.goalsAgainst ?? 0)
    case 'wins':
      return (b.wins ?? 0) - (a.wins ?? 0)
    case 'away_goals_scored':
      return (awayGoalsByTeam.get(b.teamId) ?? 0) - (awayGoalsByTeam.get(a.teamId) ?? 0)
    default:
      return 0
  }
}

function compareH2hByCriterion(
  a: MiniLeagueStats,
  b: MiniLeagueStats,
  criterion: TiebreakerCriterion
): number {
  switch (criterion) {
    case 'head_to_head_points':
      return b.points - a.points
    case 'head_to_head_goal_difference':
      return b.goalDifference - a.goalDifference
    case 'head_to_head_goals_scored':
      return b.goalsScored - a.goalsScored
    default:
      return 0
  }
}

function isTiedOnCriteria(
  a: StandingSortRow,
  b: StandingSortRow,
  criteria: TiebreakerCriterion[],
  awayGoalsByTeam: Map<number, number>
): boolean {
  for (const criterion of criteria) {
    if (isH2hCriterion(criterion) || criterion === 'head_to_head_mini_league') {
      continue
    }

    if (compareByCriterion(a, b, criterion, awayGoalsByTeam) !== 0) {
      return false
    }
  }

  return true
}

function findTiedGroup(
  anchor: StandingSortRow,
  standings: StandingSortRow[],
  prefixCriteria: TiebreakerCriterion[],
  awayGoalsByTeam: Map<number, number>
): StandingSortRow[] {
  return standings.filter(
    (row) =>
      (row.points ?? 0) === (anchor.points ?? 0) &&
      isTiedOnCriteria(anchor, row, prefixCriteria, awayGoalsByTeam)
  )
}

function compareStandings(
  a: StandingSortRow,
  b: StandingSortRow,
  tiebreaker: LeagueTiebreaker,
  standings: StandingSortRow[],
  games: Game[],
  awayGoalsByTeam: Map<number, number>
): number {
  if ((b.points ?? 0) !== (a.points ?? 0)) {
    return (b.points ?? 0) - (a.points ?? 0)
  }

  const criteria = TIEBREAKER_PRESETS[tiebreaker]

  for (let index = 0; index < criteria.length; index++) {
    const criterion = criteria[index]!

    if (criterion === 'head_to_head_mini_league' || isH2hCriterion(criterion)) {
      const prefixCriteria = criteria.slice(0, index)
      const group = findTiedGroup(a, standings, prefixCriteria, awayGoalsByTeam)

      if (group.length >= 2) {
        const groupTeamIds = group.map((row) => row.teamId)
        const h2hA = computeMiniLeagueStats(a.teamId, groupTeamIds, games)
        const h2hB = computeMiniLeagueStats(b.teamId, groupTeamIds, games)

        const block =
          criterion === 'head_to_head_mini_league'
            ? h2hCriteriaFromPreset(criteria)
            : criteria.slice(index).filter((value) => isH2hCriterion(value))

        for (const h2hCriterion of block) {
          const diff = compareH2hByCriterion(h2hA, h2hB, h2hCriterion)
          if (diff !== 0) {
            return diff
          }
        }
      }

      if (criterion === 'head_to_head_mini_league') {
        index++
      } else {
        while (index + 1 < criteria.length && isH2hCriterion(criteria[index + 1]!)) {
          index++
        }
      }

      continue
    }

    const diff = compareByCriterion(a, b, criterion, awayGoalsByTeam)
    if (diff !== 0) {
      return diff
    }
  }

  return a.teamId - b.teamId
}

export function sortStandingsByTiebreaker(
  standings: StandingSortRow[],
  tiebreaker: LeagueTiebreaker,
  games: Game[]
): StandingSortRow[] {
  const awayGoalsByTeam = new Map<number, number>()

  for (const row of standings) {
    awayGoalsByTeam.set(row.teamId, computeAwayGoalsScored(row.teamId, games))
  }

  return [...standings].sort((a, b) =>
    compareStandings(a, b, tiebreaker, standings, games, awayGoalsByTeam)
  )
}
