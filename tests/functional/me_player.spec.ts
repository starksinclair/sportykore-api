import env from '#start/env'
import Country from '#models/country'
import User from '#models/user'
import { test } from '@japa/runner'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

const jsonHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
} as const

function apiUrl(path: string) {
  const base = env.get('APP_URL').replace(/\/$/, '')
  return `${base}${path}`
}

async function readJson(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { _raw: text }
  }
}

async function makeAuthedUser(email: string) {
  const user = await User.create({ email, password: 'password1', fullName: 'Me Player Tester' })
  const token = await User.accessTokens.create(user, ['*'], { name: 'test', expiresIn: '30d' })
  return { user, authHeader: { Authorization: `Bearer ${token.value!.release()}` } }
}

test.group('GET/POST/PUT /api/v1/me/player', (group) => {
  withFreshDatabaseAndCountries(group)

  test('GET returns 404 before a profile exists', async ({ assert }) => {
    const { authHeader } = await makeAuthedUser('no-profile@test.com')

    const res = await fetch(apiUrl('/api/v1/me/player'), {
      headers: { ...jsonHeaders, ...authHeader },
    })

    assert.equal(res.status, 404)
  })

  test('GET without a bearer token is rejected', async ({ assert }) => {
    const res = await fetch(apiUrl('/api/v1/me/player'), { headers: jsonHeaders })
    assert.equal(res.status, 401)
  })

  test('POST creates a profile, then GET returns 200 with completeness', async ({ assert }) => {
    const { authHeader } = await makeAuthedUser('create-profile@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    const createRes = await fetch(apiUrl('/api/v1/me/player'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authHeader },
      body: JSON.stringify({
        name: 'New Profile',
        countryId: country.id,
        bio: 'Box-to-box midfielder',
        primaryPosition: 'midfield',
        dateOfBirth: '2000-01-15',
      }),
    })
    assert.equal(createRes.status, 201)

    const getRes = await fetch(apiUrl('/api/v1/me/player'), {
      headers: { ...jsonHeaders, ...authHeader },
    })
    assert.equal(getRes.status, 200)
    const body = await readJson(getRes)

    assert.equal(body.data.player.name, 'New Profile')
    assert.isNumber(body.data.player.age)
    assert.isNumber(body.data.completeness)
    assert.isArray(body.data.missingFields)
    assert.equal(body.data.highlightsCount, 0)
    assert.deepEqual(body.data.membership, { inLeague: false, inTeam: false })

    // date_of_birth is stored but never serialized — only the computed `age`
    assert.notProperty(body.data.player, 'dateOfBirth')
    assert.notInclude(JSON.stringify(body), '2000-01-15')
    assert.notInclude(JSON.stringify(body), 'date_of_birth')
  })

  test('a second POST is rejected with 409', async ({ assert }) => {
    const { authHeader } = await makeAuthedUser('second-create@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    const body = JSON.stringify({ name: 'First', countryId: country.id })
    const first = await fetch(apiUrl('/api/v1/me/player'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authHeader },
      body,
    })
    assert.equal(first.status, 201)

    const second = await fetch(apiUrl('/api/v1/me/player'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authHeader },
      body,
    })
    assert.equal(second.status, 409)
  })

  test('PUT updates the profile fields', async ({ assert }) => {
    const { authHeader } = await makeAuthedUser('update-profile@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    await fetch(apiUrl('/api/v1/me/player'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authHeader },
      body: JSON.stringify({ name: 'Before', countryId: country.id }),
    })

    const putRes = await fetch(apiUrl('/api/v1/me/player'), {
      method: 'PUT',
      headers: { ...jsonHeaders, ...authHeader },
      body: JSON.stringify({ name: 'After', city: 'Abuja', preferredFoot: 'right' }),
    })
    assert.equal(putRes.status, 200)
    const body = await readJson(putRes)
    assert.equal(body.data.player.name, 'After')
    assert.equal(body.data.player.city, 'Abuja')
    assert.equal(body.data.player.preferredFoot, 'right')
  })
})

test.group('Player highlights API', (group) => {
  withFreshDatabaseAndCountries(group)

  async function withProfile(email: string) {
    const authed = await makeAuthedUser(email)
    const country = await Country.findByOrFail('code', 'ng')
    await fetch(apiUrl('/api/v1/me/player'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authed.authHeader },
      body: JSON.stringify({ name: email, countryId: country.id }),
    })
    return authed
  }

  test('URL parsing accepts watch/shorts/youtu.be forms and rejects non-YouTube links', async ({
    assert,
  }) => {
    const { authHeader } = await withProfile('highlight-parse@test.com')

    const accepted = await fetch(apiUrl('/api/v1/me/player/highlights'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authHeader },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s' }),
    })
    assert.equal(accepted.status, 201)
    const acceptedBody = await readJson(accepted)
    assert.equal(acceptedBody.data.videoId, 'dQw4w9WgXcQ')

    const rejected = await fetch(apiUrl('/api/v1/me/player/highlights'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...authHeader },
      body: JSON.stringify({ url: 'https://vimeo.com/12345' }),
    })
    assert.equal(rejected.status, 422)
  })

  test("a non-owner cannot delete another player's highlight", async ({ assert }) => {
    const owner = await withProfile('highlight-owner@test.com')
    const intruder = await withProfile('highlight-intruder@test.com')

    const created = await fetch(apiUrl('/api/v1/me/player/highlights'), {
      method: 'POST',
      headers: { ...jsonHeaders, ...owner.authHeader },
      body: JSON.stringify({ url: 'https://youtu.be/aaaaaaaaaaa' }),
    })
    const { data } = await readJson(created)

    const deleteRes = await fetch(apiUrl(`/api/v1/me/player/highlights/${data.id}`), {
      method: 'DELETE',
      headers: { ...jsonHeaders, ...intruder.authHeader },
    })
    assert.equal(deleteRes.status, 404)
  })
})
