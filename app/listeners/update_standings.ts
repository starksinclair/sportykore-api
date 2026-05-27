import { inject } from '@adonisjs/core'
import StandingService from '#services/standing_service'
import transmit from '#config/transmit'
import GameResultUpdated from '#events/game_updated'

@inject()
export default class UpdateStandings {
  constructor(private standingService: StandingService) {}

  async handle(event: GameResultUpdated) {
    console.log('Update standings starting')
    await this.standingService.recalculate(event.game.seasonId, event.game.homeTeamId)
    await this.standingService.recalculate(event.game.seasonId, event.game.awayTeamId)

    transmit.broadcast(`games/${event.game.id}`, {
      type: 'game_updated',
      reason: event.reason,
      gameId: event.game.id,
    })
  }
}
