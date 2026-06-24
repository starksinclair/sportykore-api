import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import { test } from '@japa/runner'

import { events } from '#generated/events'

test.group('GameUpdated event wiring', (group) => {
  group.setup(async () => {
    await app.init()
    await app.boot()
  })

  test('GameUpdated listener is registered after boot', async ({ assert }) => {
    assert.isTrue(emitter.hasListeners(events.GameUpdated))
    assert.isAbove(emitter.listenerCount(events.GameUpdated), 0)
  })
})
