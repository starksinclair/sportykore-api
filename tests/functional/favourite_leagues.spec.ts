import env from '#start/env'
import Country from '#models/country'
import FavouriteLeague from '#models/favourite_league'
import League from '#models/league'
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

async function signupToken(email: string) {
  const res = await fetch(apiUrl('/api/v1/auth/signup'), {
    method: 'POST',
    headers: { ...jsonHeaders },
    body: JSON.stringify({
      email,
      password: 'password1',
      passwordConfirmation: 'password1',
      fullName: 'Favourite Tester',
    }),
  })

  const body = await readJson(res)
  return { status: res.status, token: body.data?.auth?.token?.value as string | undefined }
}

async function createLeague(ownerEmail: string) {
  const owner = await User.create({
    email: ownerEmail,
    password: 'password1',
    fullName: 'League Owner',
  })
  const country = await Country.findByOrFail('code', 'ng')

  return League.create({
    name: 'Favourite Test League',
    userId: owner.id,
    countryId: country.id,
  })
}

test.group('Favourite leagues API', (group) => {
  withFreshDatabaseAndCountries(group)

  test('POST /api/v1/leagues/:leagueId/favorite returns 401 without bearer token', async ({
    assert,
  }) => {
    const league = await createLeague('owner-unauth@kpakore.test')

    const res = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'POST',
      headers: { ...jsonHeaders },
    })

    assert.equal(res.status, 401)
  })

  test('POST favourite adds league and returns 200', async ({ assert }) => {
    const league = await createLeague('owner-add@kpakore.test')
    const { status, token } = await signupToken('fav-add@kpakore.test')
    assert.equal(status, 201)
    assert.isString(token)

    const res = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })

    assert.equal(res.status, 200)
    const body = await readJson(res)
    assert.equal(body.message, 'League added to favorites')

    const favouriteUser = await User.findByOrFail('email', 'fav-add@kpakore.test')
    const row = await FavouriteLeague.query()
      .where('user_id', favouriteUser.id)
      .where('league_id', league.id)
      .first()
    assert.isNotNull(row)
  })

  test('POST favourite returns 409 when already favourited', async ({ assert }) => {
    const league = await createLeague('owner-dup@kpakore.test')
    const { token } = await signupToken('fav-dup@kpakore.test')
    assert.isString(token)

    const first = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })
    assert.equal(first.status, 200)

    const second = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })

    assert.equal(second.status, 409)
    const body = await readJson(second)
    assert.equal(body.message, 'League is already in favorites')
  })

  test('POST favourite returns 422 for non-existent league id', async ({ assert }) => {
    const { token } = await signupToken('fav-missing@kpakore.test')
    assert.isString(token)

    const res = await fetch(apiUrl('/api/v1/leagues/999999/favorite'), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })

    assert.equal(res.status, 422)
    const body = await readJson(res)
    assert.property(body, 'errors')
  })

  test('POST favourite returns 422 for invalid league id', async ({ assert }) => {
    const { token } = await signupToken('fav-invalid@kpakore.test')
    assert.isString(token)

    const res = await fetch(apiUrl('/api/v1/leagues/not-a-number/favorite'), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })

    assert.equal(res.status, 422)
    const body = await readJson(res)
    assert.property(body, 'errors')
  })

  test('DELETE favourite removes league and returns 200', async ({ assert }) => {
    const league = await createLeague('owner-del@kpakore.test')
    const { token } = await signupToken('fav-del@kpakore.test')
    assert.isString(token)

    const add = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })
    assert.equal(add.status, 200)

    const res = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'DELETE',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })

    assert.equal(res.status, 200)
    const body = await readJson(res)
    assert.equal(body.message, 'League removed from favorites')

    const favouriteUser = await User.findByOrFail('email', 'fav-del@kpakore.test')
    const row = await FavouriteLeague.query()
      .where('user_id', favouriteUser.id)
      .where('league_id', league.id)
      .first()
    assert.isNull(row)
  })

  test('DELETE favourite is idempotent when not favourited', async ({ assert }) => {
    const league = await createLeague('owner-idem@kpakore.test')
    const { token } = await signupToken('fav-idem@kpakore.test')
    assert.isString(token)

    const res = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'DELETE',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })

    assert.equal(res.status, 200)
    const body = await readJson(res)
    assert.equal(body.message, 'League removed from favorites')
  })

  test('DELETE favourite returns 401 without bearer token', async ({ assert }) => {
    const league = await createLeague('owner-del-unauth@kpakore.test')

    const res = await fetch(apiUrl(`/api/v1/leagues/${league.id}/favorite`), {
      method: 'DELETE',
      headers: { ...jsonHeaders },
    })

    assert.equal(res.status, 401)
  })
})
