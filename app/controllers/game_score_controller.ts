import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import GameScoreService from '#services/game_score_service'
import { accreditStatValidator, updateGameScoreValidator } from '#validators/game_score'

@inject()
export default class GameScoreController {
  constructor(protected gameScoreService: GameScoreService) {}

  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateGameScoreValidator)
    const { game, statId } = await this.gameScoreService.updateScore(Number(params.gameId), data)

    return response.ok({
      message: data.action === 'increment' ? 'Score incremented' : 'Score decremented',
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      statId,
    })
  }

  async accredit({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(accreditStatValidator)
    const stat = await this.gameScoreService.accredit(
      Number(params.gameId),
      Number(params.statId),
      data
    )

    return response.ok({
      message: 'Goal accredited',
      statId: stat.id,
    })
  }
}
