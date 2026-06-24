import { inject } from '@adonisjs/core'
import { events } from '#generated/events'
import StandingService from '#services/standing_service'
import transmit from '@adonisjs/transmit/services/main'

@inject()
export default class UpdateStandings {
  constructor(private standingService: StandingService) {}

  async handle(event: InstanceType<typeof events.GameUpdated>) {
    if (event.reason !== 'result') {
      return
    }

    await this.standingService.recalculateForGame(
      event.game.seasonId,
      event.game.homeTeamId,
      event.game.awayTeamId
    )

    transmit.broadcast(`games/${event.game.id}`, {
      type: 'game_updated',
      reason: event.reason,
      gameId: event.game.id,
    })
  }
}
