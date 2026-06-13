import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import Game from '#models/game'
import GameTimeService from '#services/game_time_service'
import { endGameValidator } from '#validators/game_time'

@inject()
export default class GameTimeController {
  constructor(protected gameTimeService: GameTimeService) {}

  async startFirstHalf({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.startFirstHalf(game)

    return response.ok({ message: 'First half started' })
  }

  async startHalfTime({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.startHalfTime(game)

    return response.ok({ message: 'Half time' })
  }

  async startSecondHalf({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.startSecondHalf(game)

    return response.ok({ message: 'Second half started' })
  }

  async startExtraTime({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.startExtraTime(game)

    return response.ok({ message: 'Extra time started' })
  }

  async pause({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.pauseGame(game)

    return response.ok({ message: 'Game paused' })
  }

  async resume({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.resumeGame(game)

    return response.ok({ message: 'Game resumed' })
  }

  async endGame({ params, request, response }: HttpContext) {
    const { homeScore, awayScore } = await request.validateUsing(endGameValidator)
    const game = await Game.findOrFail(params.gameId)
    await this.gameTimeService.endGame(game, homeScore, awayScore)

    return response.ok({ message: 'Full time' })
  }
}
