import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import PlayerProfileService from '#services/player_profile_service'
import PlayerTransformer from '#transformers/player_transformer'
import {
  createPlayerProfileValidator,
  playerPhotoValidator,
  updatePlayerProfileValidator,
} from '#validators/player'

/**
 * The authenticated user's own player profile. GET is the two-state CTA
 * resolver: 200 with the profile, or 404 as the "no profile yet" signal.
 */
@inject()
export default class MePlayerController {
  constructor(protected profileService: PlayerProfileService) {}

  async show({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const resolved = await this.profileService.resolveOwn(user.id)

    return serialize({
      player: PlayerTransformer.transform(resolved.player)?.useVariant('profile'),
      completeness: resolved.completeness,
      missingFields: resolved.missingFields,
      highlightsCount: resolved.highlightsCount,
      membership: resolved.membership,
    })
  }

  async store({ auth, request, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(createPlayerProfileValidator)
    const player = await this.profileService.createOwn(user.id, data)

    return response.created(
      await serialize({ player: PlayerTransformer.transform(player)?.useVariant('profile') })
    )
  }

  async update({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(updatePlayerProfileValidator)
    const player = await this.profileService.updateOwn(user.id, data)

    return serialize({ player: PlayerTransformer.transform(player)?.useVariant('profile') })
  }

  async photo({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { photo } = await request.validateUsing(playerPhotoValidator)
    const player = await this.profileService.uploadPhoto(user.id, photo)

    return serialize({ player: PlayerTransformer.transform(player)?.useVariant('profile') })
  }
}
