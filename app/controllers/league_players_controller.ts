import type { HttpContext } from '@adonisjs/core/http'

import LeaguePlayer from '#models/league_player'
import { updateLeaguePlayerValidator } from '#validators/league_player'
import LeaguePlayerTransformer from '#transformers/league_player_transformer'

export default class LeaguePlayersController {
  async roster({ params, serialize }: HttpContext) {
    const leagueId = Number(params.leagueId)
    const seasonId = Number(params.seasonId)

    const roster = await LeaguePlayer.query()
      .where('league_id', leagueId)
      .where('season_id', seasonId)
      .preload('player')
      .preload('team')
      .orderBy('team_id', 'asc')
      .orderBy('jersey_number', 'asc')

    return serialize(LeaguePlayerTransformer.transform(roster)?.useVariant('withPlayer'))
  }

  async update({ params, request, response }: HttpContext) {
    const leaguePlayer = await LeaguePlayer.findOrFail(params.id)
    const data = await request.validateUsing(updateLeaguePlayerValidator)

    leaguePlayer.merge(data)
    await leaguePlayer.save()

    return response.ok({ message: 'League player updated successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    const leaguePlayer = await LeaguePlayer.findOrFail(params.id)
    await leaguePlayer.delete()

    return response.ok({ message: 'League player removed successfully' })
  }
}
