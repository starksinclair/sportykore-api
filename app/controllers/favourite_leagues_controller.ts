import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import FavouriteLeagueService from '#services/favourite_league_service'
import { favouriteLeagueParamsValidator } from '#validators/favourite_league'

@inject()
export default class FavouriteLeaguesController {
  constructor(private favouriteLeagueService: FavouriteLeagueService) {}

  async store({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { leagueId } = await request.validateUsing(favouriteLeagueParamsValidator, {
      data: { leagueId: params.leagueId },
    })

    await this.favouriteLeagueService.add(user, leagueId)

    return response.ok({ message: 'League added to favorites' })
  }

  async destroy({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { leagueId } = await request.validateUsing(favouriteLeagueParamsValidator, {
      data: { leagueId: params.leagueId },
    })

    await this.favouriteLeagueService.remove(user, leagueId)

    return response.ok({ message: 'League removed from favorites' })
  }
}
