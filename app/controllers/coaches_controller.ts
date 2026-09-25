import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'

import CoachProfileService from '#services/coach_profile_service'
import CoachProfileTransformer from '#transformers/coach_profile_transformer'

@inject()
export default class CoachesController {
  constructor(protected profileService: CoachProfileService) {}

  async show({ params, serialize }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id) || id <= 0) {
      throw new Exception('Invalid coach id', { status: 400 })
    }

    const profile = await this.profileService.findPublic(id)

    return serialize({
      coach: CoachProfileTransformer.transform(profile),
    })
  }
}
