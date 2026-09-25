import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import CoachProfileService from '#services/coach_profile_service'
import CoachProfileTransformer from '#transformers/coach_profile_transformer'
import {
  coachPhotoValidator,
  createCoachProfileValidator,
  updateCoachProfileValidator,
} from '#validators/coach'

@inject()
export default class MeCoachController {
  constructor(protected profileService: CoachProfileService) {}

  async show({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const profile = await this.profileService.resolveOwn(user.id)

    return serialize({
      coach: CoachProfileTransformer.transform(profile)?.useVariant('ownProfile'),
    })
  }

  async store({ auth, request, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(createCoachProfileValidator)
    const profile = await this.profileService.createOwn(user.id, data)

    return response.created(
      await serialize({
        coach: CoachProfileTransformer.transform(profile)?.useVariant('ownProfile'),
      })
    )
  }

  async update({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(updateCoachProfileValidator)
    const profile = await this.profileService.updateOwn(user.id, data)

    return serialize({
      coach: CoachProfileTransformer.transform(profile)?.useVariant('ownProfile'),
    })
  }

  async photo({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { photo } = await request.validateUsing(coachPhotoValidator)
    const profile = await this.profileService.uploadPhoto(user.id, photo)

    return serialize({
      coach: CoachProfileTransformer.transform(profile)?.useVariant('ownProfile'),
    })
  }
}
