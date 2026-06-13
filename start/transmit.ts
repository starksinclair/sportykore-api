import logger from '@adonisjs/core/services/logger'
import transmit from '@adonisjs/transmit/services/main'

transmit.on('connect', ({ uid }) => {
  logger.info({ uid }, 'Transmit client connected')
})
