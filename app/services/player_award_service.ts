import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'

import Game from '#models/game'
import GameLineup from '#models/game_lineup'
import PlayerAward from '#models/player_award'

@inject()
export default class PlayerAwardService {
  async setMotm(gameId: number, playerId: number, awardedBy: number): Promise<PlayerAward> {
    const game = await Game.findOrFail(gameId)

    const lineup = await GameLineup.query()
      .where('game_id', game.id)
      .where('player_id', playerId)
      .whereIn('team_id', [game.homeTeamId, game.awayTeamId])
      .whereIn('status', ['starter', 'substitute'])
      .first()

    if (!lineup) {
      throw new Exception('Player must be in the active lineup for this match', { status: 422 })
    }

    const award = await PlayerAward.updateOrCreate(
      { gameId: game.id, awardType: 'motm' },
      { playerId, awardedBy }
    )

    await award.load('player')
    await award.load('awardedByUser')

    return award
  }
}
