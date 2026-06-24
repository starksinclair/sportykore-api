import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Game from '#models/game'
import { sortStandingsByTiebreaker } from '#services/standing_tiebreaker'
import type { StandingSortRow } from '#services/standing_tiebreaker'

function standingRow(
  overrides: Partial<StandingSortRow> & Pick<StandingSortRow, 'id' | 'teamId'>
): StandingSortRow {
  return {
    points: 0,
    wins: 0,
    goalDifference: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    ...overrides,
  }
}

function gameRow(
  overrides: Partial<Game> & Pick<Game, 'homeTeamId' | 'awayTeamId'>
): Game {
  return {
    id: 0,
    seasonId: 1,
    leagueId: 1,
    playedAt: DateTime.utc(),
    status: 'full_time',
    homeScore: 0,
    awayScore: 0,
    ...overrides,
  } as Game
}

test.group('sortStandingsByTiebreaker', () => {
  test('goal_difference_goals_scored breaks ties by GD then GS', ({ assert }) => {
    const standings = [
      standingRow({ id: 1, teamId: 1, points: 6, goalDifference: 2, goalsFor: 8 }),
      standingRow({ id: 2, teamId: 2, points: 6, goalDifference: 5, goalsFor: 10 }),
      standingRow({ id: 3, teamId: 3, points: 6, goalDifference: 5, goalsFor: 12 }),
    ]

    const sorted = sortStandingsByTiebreaker(standings, 'goal_difference_goals_scored', [])
    assert.deepEqual(
      sorted.map((row) => row.teamId),
      [3, 2, 1]
    )
  })

  test('goals_scored_goal_difference prefers goals scored before GD', ({ assert }) => {
    const standings = [
      standingRow({ id: 1, teamId: 1, points: 3, goalDifference: 1, goalsFor: 6 }),
      standingRow({ id: 2, teamId: 2, points: 3, goalDifference: 4, goalsFor: 5 }),
    ]

    const sorted = sortStandingsByTiebreaker(standings, 'goals_scored_goal_difference', [])
    assert.deepEqual(
      sorted.map((row) => row.teamId),
      [1, 2]
    )
  })

  test('away_goals_scored preset uses away goals in tied groups', ({ assert }) => {
    const standings = [
      standingRow({ id: 1, teamId: 1, points: 3, goalDifference: 0, goalsFor: 2 }),
      standingRow({ id: 2, teamId: 2, points: 3, goalDifference: 0, goalsFor: 2 }),
    ]

    const games = [
      gameRow({ homeTeamId: 1, awayTeamId: 2, homeScore: 1, awayScore: 1 }),
      gameRow({ homeTeamId: 3, awayTeamId: 1, homeScore: 2, awayScore: 0 }),
      gameRow({ homeTeamId: 2, awayTeamId: 4, homeScore: 0, awayScore: 1 }),
    ]

    const sorted = sortStandingsByTiebreaker(
      standings,
      'away_goals_scored_goal_difference_goals_scored',
      games
    )

    assert.deepEqual(
      sorted.map((row) => row.teamId),
      [2, 1]
    )
  })

  test('head_to_head mini-league resolves three-way ties on points', ({ assert }) => {
    const standings = [
      standingRow({ id: 1, teamId: 1, points: 4, goalDifference: 0, goalsFor: 3, goalsAgainst: 3 }),
      standingRow({ id: 2, teamId: 2, points: 4, goalDifference: 0, goalsFor: 3, goalsAgainst: 3 }),
      standingRow({ id: 3, teamId: 3, points: 4, goalDifference: 0, goalsFor: 3, goalsAgainst: 3 }),
      standingRow({ id: 4, teamId: 4, points: 9, goalDifference: 5, goalsFor: 10, goalsAgainst: 5 }),
    ]

    const games = [
      gameRow({ homeTeamId: 1, awayTeamId: 2, homeScore: 1, awayScore: 0 }),
      gameRow({ homeTeamId: 2, awayTeamId: 3, homeScore: 1, awayScore: 0 }),
      gameRow({ homeTeamId: 3, awayTeamId: 1, homeScore: 1, awayScore: 0 }),
      gameRow({ homeTeamId: 4, awayTeamId: 1, homeScore: 3, awayScore: 0 }),
      gameRow({ homeTeamId: 4, awayTeamId: 2, homeScore: 3, awayScore: 0 }),
      gameRow({ homeTeamId: 4, awayTeamId: 3, homeScore: 3, awayScore: 0 }),
    ]

    const sorted = sortStandingsByTiebreaker(
      standings,
      'head_to_head_goal_difference_goals_scored',
      games
    )

    assert.equal(sorted[0]!.teamId, 4)
    assert.deepEqual(
      sorted.slice(1).map((row) => row.teamId),
      [1, 2, 3]
    )
  })
})
