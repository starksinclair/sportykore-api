import type { HttpContext } from '@adonisjs/core/http'
import GameTransformer from '#transformers/game_transformer'
import { inject } from '@adonisjs/core'
import { GameService } from '#services/game_service'
import Game from '#models/game'
import { createGameValidator, updateGameValidator } from '#validators/game'

@inject()
export default class GamesController {
  constructor(protected gameService: GameService) {}
  async show({ params, serialize }: HttpContext) {
    const { id } = params
    const game = await this.gameService.getGameDetails(Number(id))
    return serialize(GameTransformer.transform(game)?.useVariant('forDetail'))
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createGameValidator)
    await Game.create(data)
    return response.created({ message: 'Game created successfully' })
  }

  async update({ params, response, request }: HttpContext) {
    const { id } = params
    const data = await request.validateUsing(updateGameValidator)
    const game = await Game.findOrFail(id)
    game.merge(data)
    await game.save()
    return response.ok({ message: 'Game updated successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.id)
    await game.delete()

    return response.ok({ message: 'Game deleted successfully' })
  }
}
