import testUtils from '@adonisjs/core/services/test_utils'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

import User from '#models/user'
import UserAuthService from '#services/user_auth_service'
import AuthSessionTransformer from '#transformers/auth_session_transformer'
import { withFreshDatabase } from '../helpers/migration.js'

test.group('UserAuthService', (group) => {
  withFreshDatabase(group)

  test('toUserDto returns public fields only', async ({ assert }) => {
    const service = new UserAuthService(hash)
    const user = new User()
    user.merge({ id: 42, email: 'fan@kpakore.test', fullName: 'Sam Fan' })

    assert.deepEqual(service.toUserDto(user), {
      id: 42,
      email: 'fan@kpakore.test',
      fullName: 'Sam Fan',
    })
  })

  test('AuthSessionTransformer wraps bearer payload from token secret', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    const user = new User()
    user.merge({ id: 7, email: 'tok@kpakore.test', fullName: 'T' })

    const accessToken = {
      value: { release: () => 'oat_secret_value' },
      expiresAt: null,
      abilities: ['*'],
    } as unknown as AccessToken

    const body = await ctx.serialize({
      auth: AuthSessionTransformer.transform({ user, accessToken }),
    })

    assert.deepEqual(body.data.auth.user, { id: 7, email: 'tok@kpakore.test', fullName: 'T' })
    assert.equal(body.data.auth.token.type, 'bearer')
    assert.equal(body.data.auth.token.value, 'oat_secret_value')
    assert.isNull(body.data.auth.token.expiresAt)
    assert.deepEqual(body.data.auth.token.abilities, ['*'])
  })

  test('loginWithPassword rejects invalid credentials', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    const service = new UserAuthService(hash)

    await User.create({
      email: 'badcreds@kpakore.test',
      password: 'password1',
      fullName: 'X',
    })

    try {
      await service.loginWithPassword(ctx.auth, 'badcreds@kpakore.test', 'wrong-password')
      assert.fail('expected login to throw')
    } catch (error) {
      assert.instanceOf(error, Error)
      assert.equal((error as { code?: string }).code, 'E_INVALID_CREDENTIALS')
    }
  })

  test('requestPasswordReset is a no-op for unknown email', async ({ assert }) => {
    const service = new UserAuthService(hash)
    await service.requestPasswordReset('missing@kpakore.test')

    const rows = await db.from('password_resets').select('*')
    assert.lengthOf(rows, 0)
  })

  test('requestPasswordReset stores hashed token for existing user', async ({ assert }) => {
    const service = new UserAuthService(hash)
    const user = await User.create({
      email: 'resetme@kpakore.test',
      password: 'password1',
      fullName: 'Reset Me',
    })

    await service.requestPasswordReset('resetme@kpakore.test')

    const row = await db.from('password_resets').where('user_id', user.id).first()
    assert.exists(row)
    assert.equal(row.token_hash.length, 64)
  })

  test('resetPasswordWithToken updates password and clears reset row', async ({ assert }) => {
    const service = new UserAuthService(hash)
    const user = await User.create({
      email: 'tokenuser@kpakore.test',
      password: 'password1',
      fullName: 'Token User',
    })

    const plain = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(plain).digest('hex')
    await db.table('password_resets').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: DateTime.now().plus({ hours: 1 }).toJSDate(),
      created_at: new Date(),
      updated_at: new Date(),
    })

    await service.resetPasswordWithToken(plain, 'newpassword1')

    await user.refresh()
    assert.isTrue(await hash.verify(user.password, 'newpassword1'))

    const remaining = await db.from('password_resets').where('user_id', user.id)
    assert.lengthOf(remaining, 0)
  })

  test('resetPasswordWithToken throws for invalid token', async ({ assert }) => {
    const service = new UserAuthService(hash)
    await User.create({
      email: 'onlyuser@kpakore.test',
      password: 'password1',
      fullName: 'Only',
    })

    try {
      await service.resetPasswordWithToken('not-a-valid-token-hex'.padEnd(64, '0'), 'newpassword1')
      assert.fail('expected reset to throw')
    } catch (error) {
      assert.isTrue(
        error instanceof Error && (error as NodeJS.ErrnoException).code === 'E_INVALID_RESET_TOKEN'
      )
    }
  })

  test('findOrCreateFromGoogle creates then returns existing by email', async ({ assert }) => {
    const service = new UserAuthService(hash)

    const first = await service.findOrCreateFromGoogle({
      email: 'google@kpakore.test',
      name: 'Google User',
      providerId: 'sub-123',
    })
    const second = await service.findOrCreateFromGoogle({
      email: 'google@kpakore.test',
      name: 'Ignored',
      providerId: 'sub-999',
    })

    assert.equal(first.user.id, second.user.id)
    assert.equal(second.user.fullName, 'Google User')
  })
})
