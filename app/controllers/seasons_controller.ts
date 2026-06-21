import type { HttpContext } from '@adonisjs/core/http'
import Season from '#models/season'
import { createSeasonValidator } from '#validators/season'

export default class SeasonsController {
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createSeasonValidator)
    const season = await Season.create({
      leagueId: data.leagueId,
      name: data.name,
      status: data.status,
    })
    return response.created(season)
  }
}
