import { test } from '@japa/runner'

import { resolveRequestTimeZone } from '#helpers/time_zone'

function mockRequest(headers: Record<string, string | undefined>) {
  return {
    header(name: string) {
      return headers[name.toLowerCase()]
    },
  }
}

test.group('resolveRequestTimeZone', () => {
  test('prefers query param over headers', ({ assert }) => {
    const request = mockRequest({ 'time-zone': 'Europe/London' })

    assert.equal(resolveRequestTimeZone('Africa/Lagos', request), 'Africa/Lagos')
  })

  test('falls back to Time-Zone header', ({ assert }) => {
    const request = mockRequest({ 'time-zone': 'Africa/Lagos' })

    assert.equal(resolveRequestTimeZone(undefined, request), 'Africa/Lagos')
  })

  test('falls back to X-Timezone header', ({ assert }) => {
    const request = mockRequest({ 'x-timezone': 'Europe/Paris' })

    assert.equal(resolveRequestTimeZone(undefined, request), 'Europe/Paris')
  })

  test('returns undefined when nothing is provided', ({ assert }) => {
    const request = mockRequest({})

    assert.isUndefined(resolveRequestTimeZone(undefined, request))
    assert.isUndefined(resolveRequestTimeZone('   ', request))
  })
})
