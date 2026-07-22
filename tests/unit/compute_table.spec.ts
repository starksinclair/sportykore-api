import { test } from '@japa/runner'

import {
  cohortSignature,
  compareTableRows,
  computeTable,
  type ComputeTableGame,
} from '#services/standings/compute_table'

function game(
  overrides: Partial<ComputeTableGame> & Pick<ComputeTableGame, 'homeTeamId' | 'awayTeamId'>
): ComputeTableGame {
  return {
    homeScore: 0,
    awayScore: 0,
    ...overrides,
  }
}

test.group('computeTable', () => {
  test('sorts by points, then GD, then GF, then team name', ({ assert }) => {
    // Each plays two games vs out-of-table opponents (ignored for rows):
    // Charlie: 6 pts, GD 5, GF 12; Bravo: 6 pts, GD 5, GF 10; Alpha: 6 pts, GD 2, GF 8
    const teamMeta = [
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Bravo' },
      { id: 3, name: 'Charlie' },
    ]
    const games = [
      game({ homeTeamId: 1, awayTeamId: 99, homeScore: 4, awayScore: 3 }),
      game({ homeTeamId: 1, awayTeamId: 98, homeScore: 4, awayScore: 3 }),
      game({ homeTeamId: 2, awayTeamId: 99, homeScore: 6, awayScore: 2 }),
      game({ homeTeamId: 2, awayTeamId: 98, homeScore: 4, awayScore: 3 }),
      game({ homeTeamId: 3, awayTeamId: 99, homeScore: 7, awayScore: 3 }),
      game({ homeTeamId: 3, awayTeamId: 98, homeScore: 5, awayScore: 4 }),
    ]

    const sorted = computeTable(games, teamMeta)
    assert.deepEqual(
      sorted.map((row) => ({
        teamId: row.teamId,
        points: row.points,
        goalDifference: row.goalDifference,
        goalsFor: row.goalsFor,
        position: row.position,
      })),
      [
        { teamId: 3, points: 6, goalDifference: 5, goalsFor: 12, position: 1 },
        { teamId: 2, points: 6, goalDifference: 5, goalsFor: 10, position: 2 },
        { teamId: 1, points: 6, goalDifference: 2, goalsFor: 8, position: 3 },
      ]
    )
  })

  test('breaks remaining ties by team name ascending', ({ assert }) => {
    const teamMeta = [
      { id: 1, name: 'Zebra' },
      { id: 2, name: 'Aardvark' },
    ]
    const games = [
      game({ homeTeamId: 1, awayTeamId: 3, homeScore: 1, awayScore: 0 }),
      game({ homeTeamId: 2, awayTeamId: 4, homeScore: 1, awayScore: 0 }),
    ]

    const sorted = computeTable(games, teamMeta)
    assert.deepEqual(
      sorted.map((row) => row.teamId),
      [2, 1]
    )
  })

  test('includes teams with zero games and applies point adjustments before sort', ({ assert }) => {
    const teamMeta = [
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Bravo' },
      { id: 3, name: 'Charlie' },
    ]
    const games = [game({ homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 0 })]

    const sorted = computeTable(games, teamMeta, [{ teamId: 1, pointsDelta: -3 }])

    assert.lengthOf(sorted, 3)
    const alpha = sorted.find((row) => row.teamId === 1)!
    assert.equal(alpha.points, 0)
    assert.equal(alpha.pointsAdjustment, -3)
    assert.equal(sorted.find((row) => row.teamId === 3)!.played, 0)
    // Alpha GD +2 beats Charlie GD 0 and Bravo GD -2 at 0 points
    assert.deepEqual(
      sorted.map((row) => row.teamId),
      [1, 3, 2]
    )
  })

  test('form keeps last five results and treats null scores as draws', ({ assert }) => {
    const teamMeta = [{ id: 1, name: 'Home' }]
    const games = [
      game({ homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 0 }),
      game({ homeTeamId: 1, awayTeamId: 3, homeScore: 1, awayScore: 1 }),
      game({ homeTeamId: 1, awayTeamId: 4, homeScore: 0, awayScore: 2 }),
      game({ homeTeamId: 1, awayTeamId: 5, homeScore: 3, awayScore: 1 }),
      game({ homeTeamId: 1, awayTeamId: 6, homeScore: null, awayScore: null }),
      game({ homeTeamId: 1, awayTeamId: 7, homeScore: 0, awayScore: 1 }),
    ]

    const [row] = computeTable(games, teamMeta)
    assert.equal(row!.form, 'D,L,W,D,L')
    assert.equal(row!.draws, 2)
  })

  test('compareTableRows matches fixed sort order', ({ assert }) => {
    const a = { points: 6, goalDifference: 2, goalsFor: 8, teamName: 'Alpha' }
    const b = { points: 6, goalDifference: 5, goalsFor: 10, teamName: 'Bravo' }
    const c = { points: 6, goalDifference: 5, goalsFor: 12, teamName: 'Charlie' }

    assert.isBelow(compareTableRows(c, b), 0)
    assert.isBelow(compareTableRows(b, a), 0)
  })

  test('cohortSignature is stable for the same cohort', ({ assert }) => {
    const sigA = cohortSignature(6, 3, [3, 1, 2])
    const sigB = cohortSignature(6, 3, [1, 2, 3])
    const sigC = cohortSignature(6, 4, [1, 2, 3])

    assert.equal(sigA, sigB)
    assert.notEqual(sigA, sigC)
    assert.match(sigA, /^[a-f0-9]{40}$/)
  })
})
