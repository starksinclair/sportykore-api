import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

import { withFreshDatabase } from '../helpers/migration.js'

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

test.group('Users auth API', (group) => {
  withFreshDatabase(group)

  test('POST /api/v1/auth/signup returns 201 with wrapped auth payload', async ({ assert }) => {
    const res = await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'api-signup@kpakore.test',
        password: 'password1',
        passwordConfirmation: 'password1',
        fullName: 'API Signup',
      }),
    })

    assert.equal(res.status, 201)
    const body = await readJson(res)
    assert.property(body, 'data')
    assert.property(body.data, 'auth')
    assert.equal(body.data.auth.user.email, 'api-signup@kpakore.test')
    assert.equal(body.data.auth.token.type, 'bearer')
    assert.isString(body.data.auth.token.value)
  })

  test('POST /api/v1/auth/signup returns 422 when email already exists', async ({ assert }) => {
    const payload = {
      email: 'dup@kpakore.test',
      password: 'password1',
      passwordConfirmation: 'password1',
      fullName: 'Dup',
    }
    const first = await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload),
    })
    assert.equal(first.status, 201)

    const second = await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify(payload),
    })
    assert.equal(second.status, 422)
    const body = await readJson(second)
    assert.property(body, 'errors')
  })

  test('POST /api/v1/auth/login returns 200 with token', async ({ assert }) => {
    await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'login-api@kpakore.test',
        password: 'password1',
        passwordConfirmation: 'password1',
        fullName: 'L',
      }),
    })

    const res = await fetch(apiUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'login-api@kpakore.test',
        password: 'password1',
      }),
    })

    assert.equal(res.status, 200)
    const body = await readJson(res)
    assert.equal(body.data.auth.user.email, 'login-api@kpakore.test')
    assert.isString(body.data.auth.token.value)
  })

  test('POST /api/v1/auth/login returns 401 for bad password', async ({ assert }) => {
    await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'badlogin@kpakore.test',
        password: 'password1',
        passwordConfirmation: 'password1',
        fullName: 'B',
      }),
    })

    const res = await fetch(apiUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'badlogin@kpakore.test',
        password: 'wrong-password',
      }),
    })

    assert.equal(res.status, 401)
    const body = await readJson(res)
    assert.equal(body.message, 'Invalid email or password')
  })

  test('POST /api/v1/auth/forgot-password returns 204', async ({ assert }) => {
    await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'forgot@kpakore.test',
        password: 'password1',
        passwordConfirmation: 'password1',
        fullName: 'F',
      }),
    })

    const res = await fetch(apiUrl('/api/v1/auth/forgot-password'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({ email: 'forgot@kpakore.test' }),
    })

    assert.equal(res.status, 204)
  })

  test('POST /api/v1/auth/reset-password returns 204 and new password works', async ({
    assert,
  }) => {
    await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'resetflow@kpakore.test',
        password: 'password1',
        passwordConfirmation: 'password1',
        fullName: 'R',
      }),
    })

    const userRow = await db.from('users').where('email', 'resetflow@kpakore.test').first()
    const plain = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(plain).digest('hex')
    await db.table('password_resets').insert({
      user_id: userRow.id,
      token_hash: tokenHash,
      expires_at: DateTime.now().plus({ hours: 1 }).toJSDate(),
      created_at: new Date(),
      updated_at: new Date(),
    })

    const res = await fetch(apiUrl('/api/v1/auth/reset-password'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        token: plain,
        password: 'newpassword1',
        passwordConfirmation: 'newpassword1',
      }),
    })
    assert.equal(res.status, 204)

    const login = await fetch(apiUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'resetflow@kpakore.test',
        password: 'newpassword1',
      }),
    })
    assert.equal(login.status, 200)
  })

  test('POST /api/v1/auth/reset-password returns 400 for invalid token', async ({ assert }) => {
    const res = await fetch(apiUrl('/api/v1/auth/reset-password'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        token: 'a'.repeat(64),
        password: 'password1',
        passwordConfirmation: 'password1',
      }),
    })

    assert.equal(res.status, 400)
    const body = await readJson(res)
    assert.equal(body.message, 'Invalid or expired reset token')
  })

  test('POST /api/v1/auth/logout without bearer returns 401', async ({ assert }) => {
    const res = await fetch(apiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      headers: { ...jsonHeaders },
    })
    assert.equal(res.status, 401)
  })

  test('POST /api/v1/auth/logout returns 204 with valid bearer token', async ({ assert }) => {
    const signup = await fetch(apiUrl('/api/v1/auth/signup'), {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({
        email: 'logout@kpakore.test',
        password: 'password1',
        passwordConfirmation: 'password1',
        fullName: 'L',
      }),
    })
    const signupBody = await readJson(signup)
    const token = signupBody.data.auth.token.value as string

    const res = await fetch(apiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      },
    })
    assert.equal(res.status, 204)
  })
})
