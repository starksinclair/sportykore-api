import { BaseEvent } from '@adonisjs/core/events'
import type Game from '#models/game'

export default class GameResultUpdated extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(
    public game: Game,
    public reason: 'result' | 'stat'
  ) {
    super()
  }
}
