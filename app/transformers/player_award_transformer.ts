import { BaseTransformer } from '@adonisjs/core/transformers'

import type PlayerAward from '#models/player_award'
import TeamTransformer from '#transformers/team_transformer'
import UserTransformer from '#transformers/user_transformer'

export default class PlayerAwardTransformer extends BaseTransformer<PlayerAward> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'gameId', 'playerId', 'awardType', 'awardedBy']),
      player: this.playerPayload(),
      awardedByUser: UserTransformer.transform(this.whenLoaded(this.resource.awardedByUser)),
      createdAt: this.resource.createdAt,
      updatedAt: this.resource.updatedAt,
    }
  }

  forPlayerProfile() {
    const game = this.resource.game
    return {
      ...this.toObject(),
      game: game
        ? {
            id: game.id,
            status: game.status,
            playedAt: game.playedAt,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            venueName: game.venueName,
            homeTeam: TeamTransformer.transform(this.whenLoaded(game.homeTeam)),
            awayTeam: TeamTransformer.transform(this.whenLoaded(game.awayTeam)),
          }
        : undefined,
    }
  }

  private playerPayload() {
    const player = this.resource.player
    if (!player) return undefined
    if (player.visibility === 'private') {
      return {
        id: player.id,
        name: player.name,
        visibility: 'private' as const,
      }
    }

    return {
      id: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      visibility: player.visibility,
      primaryPosition: player.primaryPosition,
    }
  }
}
