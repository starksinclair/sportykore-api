import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'

import Game from '#models/game'

export default class TeamOwnerMiddleware {
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
    const isHomeTeamOwner = game.homeTeam.addedBy === user.id
    const isAwayTeamOwner = game.awayTeam.addedBy === user.id

    if (!isLeagueOwner && !isHomeTeamOwner && !isAwayTeamOwner) {
      throw new Exception('You are not authorized to control this game', { status: 403 })
    }

    await next()
  }
}
