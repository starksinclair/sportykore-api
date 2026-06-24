import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import { events } from '#generated/events'
import { listeners } from '#generated/listeners'

emitter.listen(events.GameUpdated, [listeners.UpdateStandings])

emitter.onError((event, error) => {
  const eventName = typeof event === 'function' ? event.name : String(event)
  logger.error({ err: error, event: eventName }, 'Event listener failed')
})
