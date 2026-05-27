import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

export default class FavouriteLeaguesController {
  async store({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    logger.info(`Adding league ${params.leagueId} to favorites for user ${user.id}`)

    await user.related('favoriteLeagues').attach([params.leagueId])

    logger.info(`League ${params.leagueId} added to favorites for user ${user.id}`)

    return response.ok({ message: 'League added to favorites' })
  }

  async destroy({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    await user.related('favoriteLeagues').detach([params.leagueId])

    return response.ok({ message: 'League removed from favorites' })
  }
}
