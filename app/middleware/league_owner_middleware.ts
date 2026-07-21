import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import Game from '#models/game'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Stat from '#models/stat'
import Venue from '#models/venue'
import Stage from '#models/stage'
import StandingAdjustment from '#models/standing_adjustment'
import StandingOverride from '#models/standing_override'
import StandingZone from '#models/standing_zone'

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

    if (params.gameId !== undefined && params.gameId !== null && params.gameId !== '') {
      const gameId = Number(params.gameId)
      if (!Number.isFinite(gameId) || gameId <= 0) {
        throw new Exception('Invalid game id', { status: 400 })
      }

      const game = await Game.find(gameId)
      if (game) {
        return game.leagueId
      }

      throw new Exception('Game not found', { status: 404 })
    }

    const path = request.url()

    if (params.aid !== undefined && path.includes('/adjustments/')) {
      const aid = Number(params.aid)
      if (!Number.isFinite(aid) || aid <= 0) {
        throw new Exception('Invalid adjustment id', { status: 400 })
      }
      const adjustment = await StandingAdjustment.query()
        .where('id', aid)
        .preload('stage', (q) => q.preload('season'))
        .first()
      if (adjustment?.stage?.season) {
        return adjustment.stage.season.leagueId
      }
      throw new Exception('Adjustment not found', { status: 404 })
    }

    if (params.oid !== undefined && path.includes('/overrides/')) {
      const oid = Number(params.oid)
      if (!Number.isFinite(oid) || oid <= 0) {
        throw new Exception('Invalid override id', { status: 400 })
      }
      const override = await StandingOverride.query()
        .where('id', oid)
        .preload('stage', (q) => q.preload('season'))
        .first()
      if (override?.stage?.season) {
        return override.stage.season.leagueId
      }
      throw new Exception('Override not found', { status: 404 })
    }

    if (params.zid !== undefined && path.includes('/zones/')) {
      const zid = Number(params.zid)
      if (!Number.isFinite(zid) || zid <= 0) {
        throw new Exception('Invalid zone id', { status: 400 })
      }
      const zone = await StandingZone.query()
        .where('id', zid)
        .preload('stage', (q) => q.preload('season'))
        .first()
      if (zone?.stage?.season) {
        return zone.stage.season.leagueId
      }
      throw new Exception('Zone not found', { status: 404 })
    }

    const resourceId = params.id
    if (resourceId !== undefined && resourceId !== null && resourceId !== '') {
      const id = Number(resourceId)
      if (!Number.isFinite(id) || id <= 0) {
        throw new Exception('Invalid resource id', { status: 400 })
      }

      if (path.includes('/games/')) {
        const game = await Game.find(id)
        if (game) {
          return game.leagueId
        }
      }

      if (path.includes('/venues/')) {
        const venue = await Venue.find(id)
        if (venue) {
          return venue.leagueId
        }
      }

      if (path.includes('/stages/')) {
        const stage = await Stage.query().where('id', id).preload('season').first()
        if (stage?.season) {
          return stage.season.leagueId
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
