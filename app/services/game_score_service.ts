import db from '@adonisjs/lucid/services/db'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import transmit from '@adonisjs/transmit/services/main'

import Game from '#models/game'
import Stat from '#models/stat'
import GameTimeService from '#services/game_time_service'
import StatService, { type AccreditStatInput } from '#services/stat_service'

export type UpdateGameScoreInput = {
  team: 'home' | 'away'
  action: 'increment' | 'decrement'
}

export type UpdateGameScoreResult = {
  game: Game
  statId: number | null
}

@inject()
export default class GameScoreService {
  constructor(
    protected gameTimeService: GameTimeService,
    protected statService: StatService
  ) {}

  async updateScore(gameId: number, input: UpdateGameScoreInput): Promise<UpdateGameScoreResult> {
    const game = await Game.findOrFail(gameId)

    if (input.action === 'increment') {
      return this.incrementScore(game, input.team)
    }

    return this.decrementScore(game, input.team)
  }

  async accredit(gameId: number, statId: number, input: AccreditStatInput): Promise<Stat> {
    const stat = await Stat.query()
      .where('id', statId)
      .where('game_id', gameId)
      .firstOrFail()

    if (stat.playerId !== null) {
      throw new Exception('Stat is already accredited', { status: 409 })
    }

    const goalType = await this.statService.resolveStatType('goals')
    if (stat.statTypeId !== goalType.id) {
      throw new Exception('Only unaccredited goal stats can be accredited', { status: 422 })
    }

    const accredited = await this.statService.accreditPlaceholder(stat, input)

    transmit.broadcast(`games/${gameId}`, {
      type: 'stat_accredited',
      statId: accredited.id,
    } as Record<string, string | number | null>)

    return accredited
  }

  private async incrementScore(game: Game, team: 'home' | 'away'): Promise<UpdateGameScoreResult> {
    const teamId = team === 'home' ? game.homeTeamId : game.awayTeamId
    const goalType = await this.statService.resolveStatType('goals')
    const minute = this.gameTimeService.calculateCurrentMinute(game)

    let createdStatId: number | null = null

    await db.transaction(async (trx) => {
      if (team === 'home') {
        game.homeScore = (game.homeScore ?? 0) + 1
      } else {
        game.awayScore = (game.awayScore ?? 0) + 1
      }

      game.useTransaction(trx)
      await game.save()

      const stat = await Stat.create(
        {
          gameId: game.id,
          leagueId: game.leagueId,
          seasonId: game.seasonId,
          teamId,
          statTypeId: goalType.id,
          playerId: null,
          minute,
          numericValue: 1,
        },
        { client: trx }
      )

      createdStatId = stat.id
    })

    await game.refresh()
    this.broadcastScoreUpdated(game)

    return { game, statId: createdStatId }
  }

  private async decrementScore(game: Game, team: 'home' | 'away'): Promise<UpdateGameScoreResult> {
    const teamId = team === 'home' ? game.homeTeamId : game.awayTeamId
    const goalType = await this.statService.resolveStatType('goals')

    await db.transaction(async (trx) => {
      if (team === 'home') {
        game.homeScore = Math.max(0, (game.homeScore ?? 0) - 1)
      } else {
        game.awayScore = Math.max(0, (game.awayScore ?? 0) - 1)
      }

      game.useTransaction(trx)
      await game.save()

      const placeholder = await Stat.query({ client: trx })
        .where('game_id', game.id)
        .where('team_id', teamId)
        .whereNull('player_id')
        .where('stat_type_id', goalType.id)
        .orderBy('created_at', 'desc')
        .first()

      if (placeholder) {
        await placeholder.useTransaction(trx).delete()
      }
    })

    await game.refresh()
    this.broadcastScoreUpdated(game)

    return { game, statId: null }
  }

  private broadcastScoreUpdated(game: Game) {
    transmit.broadcast(`games/${game.id}`, {
      type: 'score_updated',
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    } as Record<string, string | number | null>)
  }
}
