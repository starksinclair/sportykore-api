import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import Game from '#models/game'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Stat from '#models/stat'

export default class LeagueOwnerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const leagueId = await this.resolveLeagueId(ctx)
    const league = await League.findOrFail(leagueId)

    if (league.userId !== user.id) {
      throw new Exception('You are not authorized to manage this league', { status: 403 })
    }

    await next()
  }

  private async resolveLeagueId({ params, request }: HttpContext): Promise<number> {
    if (params.leagueId) {
      const id = Number(params.leagueId)
      if (Number.isFinite(id) && id > 0) {
        return id
      }
    }

    const fromInput = request.input('leagueId')
    if (fromInput !== undefined && fromInput !== null && fromInput !== '') {
      const id = Number(fromInput)
      if (Number.isFinite(id) && id > 0) {
        return id
      }
    }

    const resourceId = params.id
    if (resourceId !== undefined && resourceId !== null && resourceId !== '') {
      const id = Number(resourceId)
      if (!Number.isFinite(id) || id <= 0) {
        throw new Exception('Invalid resource id', { status: 400 })
      }

      const path = request.url()
      if (path.includes('/games/')) {
        const game = await Game.find(id)
        if (game) {
          return game.leagueId
        }
      }

      if (path.includes('/stats/')) {
        const stat = await Stat.find(id)
        if (stat) {
          return stat.leagueId
        }
      }

      if (path.includes('/league-players/')) {
        const leaguePlayer = await LeaguePlayer.find(id)
        if (leaguePlayer) {
          return leaguePlayer.leagueId
        }
      }
    }

    throw new Exception('League id is required', { status: 400 })
  }
}
