import env from '#start/env'
import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports/redis'

const redisTls = env.get('REDIS_TLS') ? { tls: {} as const } : {}

export default defineConfig({
  pingInterval: '30s',
  transport: {
    driver: redis({
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD'),
      keyPrefix: 'transmit',
      ...redisTls,
    }),
  },
})
