import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import transmit from '@adonisjs/transmit/services/main'
import logger from '@adonisjs/core/services/logger'

import type Game from '#models/game'
import PushNotificationService from '#services/push_notification_service'

const PAUSABLE_STATUSES = ['first_half', 'second_half', 'extra_time'] as const
type PausableStatus = (typeof PAUSABLE_STATUSES)[number]

export default class GameTimeService {
  private pushNotificationService = new PushNotificationService()

  calculateCurrentMinute(game: Game, now: DateTime = DateTime.utc()): number {
    if (game.status === 'paused') {
      if (!game.pausedAt || !game.pausedFromStatus) {
        return 0
      }
      return this.calculateMinuteForStatus(game, game.pausedFromStatus, game.pausedAt)
    }

    if (!game.status) {
      return 0
    }

    return this.calculateMinuteForStatus(game, game.status, now)
  }

  private calculateMinuteForStatus(game: Game, status: string, now: DateTime): number {
    const firstHalfDuration = game.firstHalfDuration ?? 45
    const secondHalfDuration = game.secondHalfDuration ?? 45

    switch (status) {
      case 'scheduled':
      case 'postponed':
      case 'cancelled':
        return 0

      case 'first_half':
        if (!game.firstHalfStartedAt) {
          return 0
        }
        return Math.max(0, Math.floor(now.diff(game.firstHalfStartedAt, 'minutes').minutes))

      case 'half_time':
        return firstHalfDuration

      case 'second_half':
        if (!game.secondHalfStartedAt) {
          return firstHalfDuration
        }
        return (
          firstHalfDuration +
          Math.max(0, Math.floor(now.diff(game.secondHalfStartedAt, 'minutes').minutes))
        )

      case 'extra_time':
        if (!game.extraTimeStartedAt) {
          return firstHalfDuration + secondHalfDuration
        }
        return (
          firstHalfDuration +
          secondHalfDuration +
          Math.max(0, Math.floor(now.diff(game.extraTimeStartedAt, 'minutes').minutes))
        )

      case 'full_time':
        return firstHalfDuration + secondHalfDuration

      default:
        return 0
    }
  }

  broadcastStatusChanged(game: Game) {
    transmit.broadcast(`games/${game.id}`, {
      type: 'status_changed',
      status: game.status ?? 'scheduled',
      firstHalfStartedAt: game.firstHalfStartedAt?.toISO() ?? null,
      secondHalfStartedAt: game.secondHalfStartedAt?.toISO() ?? null,
      extraTimeStartedAt: game.extraTimeStartedAt?.toISO() ?? null,
      pausedAt: game.pausedAt?.toISO() ?? null,
      pausedFromStatus: game.pausedFromStatus,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    } as Record<string, string | number | null>)
  }

  assertStatus(game: Game, allowed: Game['status'] | Game['status'][], message: string) {
    const statuses = Array.isArray(allowed) ? allowed : [allowed]
    if (!statuses.includes(game.status as Game['status'])) {
      throw new Exception(message, { status: 409 })
    }
  }

  async startFirstHalf(game: Game): Promise<Game> {
    this.assertStatus(
      game,
      ['scheduled', 'postponed'],
      'Game can only start from scheduled or postponed status'
    )

    game.status = 'first_half'
    game.firstHalfStartedAt = DateTime.utc()
    game.pausedAt = null
    game.pausedFromStatus = null
    await game.save()

    this.broadcastStatusChanged(game)
    this.queuePushNotification(this.pushNotificationService.notifyKickoff(game))
    return game
  }

  async startHalfTime(game: Game): Promise<Game> {
    this.assertStatus(game, 'first_half', 'Game must be in first half to end the half')

    game.status = 'half_time'
    await game.save()

    this.broadcastStatusChanged(game)
    return game
  }

  async startSecondHalf(game: Game): Promise<Game> {
    this.assertStatus(game, 'half_time', 'Game must be at half time to start the second half')

    game.status = 'second_half'
    game.secondHalfStartedAt = DateTime.utc()
    game.pausedAt = null
    game.pausedFromStatus = null
    await game.save()

    this.broadcastStatusChanged(game)
    return game
  }

  async startExtraTime(game: Game): Promise<Game> {
    this.assertStatus(game, 'second_half', 'Game must be in second half to start extra time')

    game.status = 'extra_time'
    game.extraTimeStartedAt = DateTime.utc()
    game.pausedAt = null
    game.pausedFromStatus = null
    await game.save()

    this.broadcastStatusChanged(game)
    return game
  }

  async pauseGame(game: Game): Promise<Game> {
    this.assertStatus(
      game,
      [...PAUSABLE_STATUSES],
      'Game can only be paused during first half, second half, or extra time'
    )

    game.pausedFromStatus = game.status as PausableStatus
    game.pausedAt = DateTime.utc()
    game.status = 'paused'
    await game.save()

    this.broadcastStatusChanged(game)
    return game
  }

  async resumeGame(game: Game): Promise<Game> {
    this.assertStatus(game, 'paused', 'Game must be paused to resume')

    if (!game.pausedFromStatus || !game.pausedAt) {
      throw new Exception('Game is missing pause metadata', { status: 409 })
    }

    const pauseDuration = DateTime.utc().diff(game.pausedAt)

    switch (game.pausedFromStatus) {
      case 'first_half':
        if (game.firstHalfStartedAt) {
          game.firstHalfStartedAt = game.firstHalfStartedAt.plus(pauseDuration)
        }
        break
      case 'second_half':
        if (game.secondHalfStartedAt) {
          game.secondHalfStartedAt = game.secondHalfStartedAt.plus(pauseDuration)
        }
        break
      case 'extra_time':
        if (game.extraTimeStartedAt) {
          game.extraTimeStartedAt = game.extraTimeStartedAt.plus(pauseDuration)
        }
        break
    }

    game.status = game.pausedFromStatus
    game.pausedFromStatus = null
    game.pausedAt = null
    await game.save()

    this.broadcastStatusChanged(game)
    return game
  }

  async endGame(game: Game, homeScore: number, awayScore: number): Promise<Game> {
    this.assertStatus(
      game,
      ['second_half', 'extra_time', 'penalty_shootout'],
      'Game can only end from second half, extra time, or penalty shootout'
    )

    game.status = 'full_time'
    game.homeScore = homeScore
    game.awayScore = awayScore
    game.pausedAt = null
    game.pausedFromStatus = null
    this.resolveGameWinner(game)
    await game.save()

    this.broadcastStatusChanged(game)
    this.queuePushNotification(this.pushNotificationService.notifyFinalScore(game))

    if (game.tieId) {
      const { default: TieResolver } = await import('#services/tie_resolver')
      await new TieResolver().advanceTie(game.tieId)
    }

    return game
  }

  async startPenaltyShootout(game: Game): Promise<Game> {
    this.assertStatus(
      game,
      ['second_half', 'extra_time'],
      'Penalties can only start after second half or extra time'
    )

    game.status = 'penalty_shootout'
    await game.save()
    this.broadcastStatusChanged(game)
    return game
  }

  async completePenaltyShootout(
    game: Game,
    homePenaltyScore: number,
    awayPenaltyScore: number
  ): Promise<Game> {
    this.assertStatus(game, 'penalty_shootout', 'Game must be in penalty shootout')

    if (homePenaltyScore === awayPenaltyScore) {
      throw new Exception('Penalty shootout must have a winner', { status: 422 })
    }

    game.homePenaltyScore = homePenaltyScore
    game.awayPenaltyScore = awayPenaltyScore
    game.winnerTeamId = homePenaltyScore > awayPenaltyScore ? game.homeTeamId : game.awayTeamId
    game.status = 'full_time'
    game.pausedAt = null
    game.pausedFromStatus = null
    await game.save()

    this.broadcastStatusChanged(game)
    this.queuePushNotification(this.pushNotificationService.notifyFinalScore(game))

    if (game.tieId) {
      const { default: TieResolver } = await import('#services/tie_resolver')
      await new TieResolver().advanceTie(game.tieId)
    }

    return game
  }

  /** Set winner_team_id from decisive score; leave null if level (needs pens). */
  resolveGameWinner(game: Game) {
    const home = game.homeScore ?? 0
    const away = game.awayScore ?? 0
    if (home === away) {
      if (game.homePenaltyScore !== null && game.awayPenaltyScore !== null) {
        if (game.homePenaltyScore !== game.awayPenaltyScore) {
          game.winnerTeamId =
            game.homePenaltyScore > game.awayPenaltyScore ? game.homeTeamId : game.awayTeamId
        }
      }
      return
    }
    game.winnerTeamId = home > away ? game.homeTeamId : game.awayTeamId
  }

  private queuePushNotification(task: Promise<void>) {
    void task.catch((error) => {
      logger.warn({ error }, 'League push notification failed')
    })
  }
}
