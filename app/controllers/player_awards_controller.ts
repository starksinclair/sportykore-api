import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import PlayerAwardService from '#services/player_award_service'
import PlayerAwardTransformer from '#transformers/player_award_transformer'
import { setMotmAwardValidator } from '#validators/player_award'

@inject()
export default class PlayerAwardsController {
  constructor(protected playerAwardService: PlayerAwardService) {}

  async setMotm({ auth, params, request, serialize }: HttpContext) {
    const data = await request.validateUsing(setMotmAwardValidator)
    const award = await this.playerAwardService.setMotm(
      Number(params.gameId),
      data.playerId,
      auth.getUserOrFail().id
    )

    return serialize(PlayerAwardTransformer.transform(award))
  }
}
