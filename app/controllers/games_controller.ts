import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import GameTransformer from '#transformers/game_transformer'
import { inject } from '@adonisjs/core'
import { GameService } from '#services/game_service'
import Game from '#models/game'
import Venue from '#models/venue'
import StageService from '#services/stage_service'
import { createGameValidator, updateGameValidator } from '#validators/game'

@inject()
export default class GamesController {
  constructor(
    protected gameService: GameService,
    protected stageService: StageService
  ) {}
  async show({ params, serialize }: HttpContext) {
    const { id } = params
    const game = await this.gameService.getGameDetails(Number(id))
    return serialize(GameTransformer.transform(game)?.useVariant('forDetail'))
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createGameValidator)
    const payload = await this.applyVenueSnapshot(data, data.leagueId)
    const stage = await this.stageService.ensureRoundRobinStage(data.seasonId)
    await Game.create({
      ...payload,
      stageId: stage.id,
    })
    return response.created({ message: 'Game created successfully' })
  }

  async update({ params, response, request }: HttpContext) {
    const { id } = params
    const data = await request.validateUsing(updateGameValidator)
    const game = await Game.findOrFail(id)
    const payload = await this.applyVenueSnapshot(data, game.leagueId)
    game.merge(payload)
    await game.save()
    return response.ok({ message: 'Game updated successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    const game = await Game.findOrFail(params.id)
    await game.delete()

    return response.ok({ message: 'Game deleted successfully' })
  }

  private async applyVenueSnapshot<T extends { venueId?: number | null; venueName?: string | null }>(
    data: T,
    leagueId: number
  ): Promise<T> {
    if (data.venueId === undefined) {
      return data
    }

    if (data.venueId === null) {
      return data
    }

    const venue = await Venue.find(data.venueId)
    if (!venue || venue.leagueId !== leagueId) {
      throw new Exception('Venue not found in this league', { status: 422 })
    }

    return {
      ...data,
      venueId: venue.id,
      venueName: venue.name,
    }
  }
}
