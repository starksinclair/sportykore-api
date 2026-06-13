import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Game from '#models/game'
import GameTimeService from '#services/game_time_service'

test.group('GameTimeService', () => {
  const service = new GameTimeService()

  test('calculateCurrentMinute returns 0 for scheduled', ({ assert }) => {
    const game = new Game()
    game.status = 'scheduled'
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45

    assert.equal(service.calculateCurrentMinute(game), 0)
  })

  test('calculateCurrentMinute for first half uses elapsed time', ({ assert }) => {
    const game = new Game()
    game.status = 'first_half'
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45
    game.firstHalfStartedAt = DateTime.utc().minus({ minutes: 12 })

    assert.equal(service.calculateCurrentMinute(game), 12)
  })

  test('calculateCurrentMinute for half time returns first half duration', ({ assert }) => {
    const game = new Game()
    game.status = 'half_time'
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45

    assert.equal(service.calculateCurrentMinute(game), 45)
  })

  test('calculateCurrentMinute for second half adds first half duration', ({ assert }) => {
    const game = new Game()
    game.status = 'second_half'
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45
    game.secondHalfStartedAt = DateTime.utc().minus({ minutes: 10 })

    assert.equal(service.calculateCurrentMinute(game), 55)
  })

  test('calculateCurrentMinute for full time returns total regulation minutes', ({ assert }) => {
    const game = new Game()
    game.status = 'full_time'
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45

    assert.equal(service.calculateCurrentMinute(game), 90)
  })

  test('calculateCurrentMinute for paused freezes at pause time', ({ assert }) => {
    const game = new Game()
    game.status = 'paused'
    game.firstHalfDuration = 45
    game.secondHalfDuration = 45
    game.firstHalfStartedAt = DateTime.utc().minus({ minutes: 30 })
    game.pausedFromStatus = 'first_half'
    game.pausedAt = DateTime.utc().minus({ minutes: 5 })

    assert.equal(service.calculateCurrentMinute(game), 25)
  })
})
