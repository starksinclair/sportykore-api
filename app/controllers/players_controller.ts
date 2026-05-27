import type { HttpContext } from '@adonisjs/core/http'
import { PlayerService } from '#services/player_service'
import { inject } from '@adonisjs/core'
import PlayerTransformer from '#transformers/player_transformer'
import PlayerLeagueDetailTransformer from '#transformers/player_league_detail_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'
import {
  acceptLeaguePlayerRequestValidator,
  createLeaguePlayerValidator,
} from '#validators/league_player'
import LeaguePlayer from '#models/league_player'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import LeaguePlayerTransformer from '#transformers/league_player_transformer'

@inject()
export default class PlayersController {
  constructor(protected playerService: PlayerService) {}
  async show({ params, serialize }: HttpContext) {
    const { id } = params
    const { player, leagues, statTypes } = await this.playerService.getPlayerDetail(id)

    return serialize({
      player: PlayerTransformer.transform(player)?.useVariant('withCountry'),
      leagues: PlayerLeagueDetailTransformer.transform(leagues)?.depth(5),
      statTypes: StatTypeTransformer.transform(statTypes),
    })
  }

  async leaguePlayerRequests({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const leaguePlayerRequests = await LeaguePlayer.query()
      .where('player_id', user.id)
      .where('status', 'pending')
      .preload('league')
      .preload('team')
    return response.ok(
      LeaguePlayerTransformer.transform(leaguePlayerRequests)?.useVariant('withLeague')
    )
  }

  async assignTeam({ request, response }: HttpContext) {
    const data = await request.validateUsing(createLeaguePlayerValidator)
    await LeaguePlayer.updateOrCreate(
      {
        playerId: data.playerId,
        leagueId: data.leagueId,
        seasonId: data.seasonId,
      },
      {
        teamId: data.teamId ?? null,
        joinedAt: data.joinedAt ?? null,
        status: data.status ?? 'active',
        position: data.position ?? null,
        jerseyNumber: data.jerseyNumber ?? null,
        isCaptain: data.isCaptain ?? false,
      }
    )
    return response.ok({
      message:
        data.status === 'active'
          ? 'Player assigned to team successfully'
          : 'Invited to join team successfully',
    })
  }

  async acceptLeaguePlayerRequest({ request, response }: HttpContext) {
    const data = await request.validateUsing(acceptLeaguePlayerRequestValidator)
    const leaguePlayer = await LeaguePlayer.query()
      .where('player_id', data.playerId)
      .where('league_id', data.leagueId)
      .where('season_id', data.seasonId)
      .first()
    if (!leaguePlayer) {
      throw new Exception('League player request not found', { status: 404 })
    }
    if (leaguePlayer.status === 'active') {
      throw new Exception('Player is already in this team for this season', { status: 409 })
    }
    leaguePlayer.status = 'active'
    leaguePlayer.joinedAt = DateTime.now()
    await leaguePlayer.save()
    return response.ok({ message: 'League player request accepted successfully' })
  }
}
