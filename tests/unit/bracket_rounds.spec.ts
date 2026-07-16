import { test } from '@japa/runner'
import { nextPow2, nextRound, roundFromSize, targetWins } from '#lib/bracket_rounds'

test.group('bracket_rounds helpers', () => {
  test('nextPow2 and roundFromSize', ({ assert }) => {
    assert.equal(nextPow2(6), 8)
    assert.equal(roundFromSize(8), 'qf')
    assert.equal(nextRound('qf'), 'sf')
    assert.equal(targetWins(5), 3)
  })
})
