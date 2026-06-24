import { BaseEvent } from '@adonisjs/core/events'
import type Game from '#models/game'

export default class GameUpdated extends BaseEvent {
  constructor(
    public game: Game,
    /** Only `result` is dispatched; `stat` is unused (stats use dedicated SSE). */
    public reason: 'result' | 'stat'
  ) {
    super()
  }
}
