import { test } from '@japa/runner'

import GameUpdated from '#events/game_updated'
import UpdateStandings from '#listeners/update_standings'
import type Game from '#models/game'
import type StandingService from '#services/standing_service'

function mockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    seasonId: 10,
    homeTeamId: 100,
    awayTeamId: 101,
    status: 'first_half',
    ...overrides,
  } as Game
}

function createListener(onRecalculate: () => void) {
  const standingService = {
    recalculateForGame: async () => {
      onRecalculate()
    },
  } as unknown as StandingService

  return new UpdateStandings(standingService)
}

test.group('UpdateStandings listener', () => {
  test('recalculates standings when reason is result', async ({ assert }) => {
    let recalcCount = 0
    const listener = createListener(() => {
      recalcCount++
    })

    await listener.handle(new GameUpdated(mockGame(), 'result'))

    assert.equal(recalcCount, 1)
  })

  test('skips standings recalc when reason is stat', async ({ assert }) => {
    let recalcCount = 0
    const listener = createListener(() => {
      recalcCount++
    })

    await listener.handle(new GameUpdated(mockGame(), 'stat'))

    assert.equal(recalcCount, 0)
  })
})
