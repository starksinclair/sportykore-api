import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import { InferConnections } from '@adonisjs/redis/types'

const redisTls = env.get('REDIS_TLS') ? { tls: {} as const } : {}

const redisConfig = defineConfig({
  connection: 'main',

  connections: {
    /*
    |--------------------------------------------------------------------------
    | The default connection
    |--------------------------------------------------------------------------
    |
    | The main connection you want to use to execute redis commands. The same
    | connection will be used by the session provider, if you rely on the
    | redis driver.
    |
    */
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 0,
      keyPrefix: '',
      // Required for Upstash / managed Redis; harmless for local Redis
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        return times > 10 ? null : times * 50
      },
      ...redisTls,
    },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
