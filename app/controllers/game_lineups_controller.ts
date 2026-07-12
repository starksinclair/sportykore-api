import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import LineupService from '#services/lineup_service'
import { setLineupValidator, updateLineupValidator } from '#validators/lineup'
import LineupGroupTransformer from '#transformers/lineup_group_transformer'

@inject()
export default class GameLineupsController {
  constructor(protected lineupService: LineupService) {}

  async index({ params, serialize }: HttpContext) {
    const groups = await this.lineupService.getLineup(Number(params.gameId))

    return serialize(LineupGroupTransformer.transform(groups))
  }

  async set({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(setLineupValidator)
    await this.lineupService.setLineup(auth.getUserOrFail().id, Number(params.gameId), data)

    return response.ok({ message: 'Lineup saved successfully' })
  }

  async update({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(updateLineupValidator)
    await this.lineupService.updateLineup(
      auth.getUserOrFail().id,
      Number(params.gameId),
      Number(params.id),
      data
    )

    return response.ok({ message: 'Lineup entry updated successfully' })
  }

  async destroy({ params, response, auth }: HttpContext) {
    await this.lineupService.removePlayer(
      auth.getUserOrFail().id,
      Number(params.gameId),
      Number(params.id)
    )

    return response.ok({ message: 'Player removed from lineup successfully' })
  }
}
