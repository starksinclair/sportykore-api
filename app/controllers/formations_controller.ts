import type { HttpContext } from '@adonisjs/core/http'

import Formation from '#models/formation'
import FormationTransformer from '#transformers/formation_transformer'

export default class FormationsController {
  async index({ serialize }: HttpContext) {
    const formations = await Formation.query().where('is_active', true).orderBy('name', 'asc')

    return serialize(FormationTransformer.transform(formations))
  }

  async show({ params, serialize }: HttpContext) {
    const formation = await Formation.findOrFail(params.id)

    return serialize(FormationTransformer.transform(formation))
  }
}
