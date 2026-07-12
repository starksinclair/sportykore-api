import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'

import Game from '#models/game'
import TeamAdmin from '#models/team_admin'

/**
 * Guards lineup mutation routes: league owner OR active team admin on home/away.
 * Team admins are further scoped to their teamId in LineupService.
 */
export default class LineupManagerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const gameId = Number(ctx.params.gameId)

    if (!Number.isFinite(gameId) || gameId <= 0) {
      throw new Exception('Invalid game id', { status: 400 })
    }

    const game = await Game.query()
      .where('id', gameId)
      .preload('league')
      .preload('homeTeam')
      .preload('awayTeam')
      .firstOrFail()

    const isLeagueOwner = game.league.userId === user.id

    const isTeamAdmin = await TeamAdmin.query()
      .whereIn('team_id', [game.homeTeam.id, game.awayTeam.id])
      .where('user_id', user.id)
      .where('league_id', game.league.id)
      .whereNull('removed_at')
      .first()

    if (!isLeagueOwner && !isTeamAdmin) {
      throw new Exception('You are not authorized to manage lineups for this game', {
        status: 403,
      })
    }

    await next()
  }
}
