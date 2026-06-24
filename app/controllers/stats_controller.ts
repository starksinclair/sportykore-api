import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import Stat from '#models/stat'
import StatService from '#services/stat_service'
import { createStatValidator } from '#validators/stat'
import { updateStatValidator } from '#validators/stat'

@inject()
export default class StatsController {
  constructor(protected statService: StatService) {}

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createStatValidator)
    await this.statService.validateForCreate(data)
    await Stat.create(data)
    return response.created({ message: 'Stat created successfully' })
  }

  async update({ params, response, request }: HttpContext) {
    const { id } = params
    const data = await request.validateUsing(updateStatValidator)
    const stat = await Stat.findOrFail(id)
    stat.merge(data)
    await stat.save()
    return response.ok({ message: 'Stat updated successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    const stat = await Stat.findOrFail(params.id)
    await stat.delete()
    return response.ok({ message: 'Stat deleted successfully' })
  }
}
