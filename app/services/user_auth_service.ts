import { createHash, randomBytes } from 'node:crypto'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'

import User from '#models/user'
import WelcomeNotification from '#mails/welcome_notification'
import limiter from '@adonisjs/limiter/services/main'
import hash from '@adonisjs/core/services/hash'
const PASSWORD_RESET_TTL_MINUTES = 60
const MOBILE_TOKEN_EXPIRES = '30d'

export type RegisterPayload = {
  email: string
  password: string
  fullName: string | null
}

export type GoogleProfile = {
  email: string
  name: string | null
  providerId: string
}

/**
 * Authentication flows for mobile clients: registration, password login,
 * Google-based provisioning, and password reset lifecycle.
 *
 * Access token creation uses the request-scoped `auth` object (api guard).
 */
export default class UserAuthService {
  /**
   * Public user fields for API responses (never includes password).
   */
  toUserDto(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    }
  }

  async registerWithPassword(
    auth: HttpContext['auth'],
    payload: RegisterPayload
  ): Promise<{ user: User; accessToken: AccessToken }> {
    const user = await User.create({
      email: payload.email,
      password: payload.password,
      fullName: payload.fullName,
    })
    const accessToken = await auth.use('api').createToken(user, ['*'], {
      name: 'mobile',
      expiresIn: MOBILE_TOKEN_EXPIRES,
    })
    await mail.sendLater(new WelcomeNotification(user))
    return { user, accessToken }
  }

  async loginWithPassword(
    auth: HttpContext['auth'],
    email: string,
    password: string,
    key: string
  ): Promise<{ user: User | undefined; accessToken: AccessToken | undefined; error: any | undefined }> {
    const loginLimiter = limiter.use({
      requests: 5,
      duration: '1 min',
      blockDuration: '20 mins'
    })
    const [error, user] = await loginLimiter.penalize(key, () => {
      return User.verifyCredentials(email, password)
    })
    if (!user) {
      return { user: undefined as unknown as User, accessToken: undefined as unknown as AccessToken, error: undefined as unknown as any }
    }
    const accessToken = await auth.use('api').createToken(user, ['*'], {
      name: 'mobile',
      expiresIn: MOBILE_TOKEN_EXPIRES,
    })
    return { user: user, accessToken: accessToken, error: error }
  }

  /**
   * Stores a one-time reset token. Always succeeds from the caller's perspective
   * (no email enumeration). In development the raw token is logged for convenience.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await User.findBy('email', email)
    if (!user) {
      return
    }

    const plain = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(plain).digest('hex')
    const expiresAt = DateTime.now().plus({ minutes: PASSWORD_RESET_TTL_MINUTES })

    await db.from('password_resets').where('user_id', user.id).delete()
    await db.table('password_resets').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toJSDate(),
      created_at: new Date(),
      updated_at: new Date(),
    })

    if (app.inDev) {
      logger.warn(`[password-reset] ${email}: ${plain}`)
    }
  }

  async resetPasswordWithToken(plainToken: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(plainToken).digest('hex')
    const row = await db
      .from('password_resets')
      .where('token_hash', tokenHash)
      .where('expires_at', '>', new Date())
      .first()

    if (!row) {
      const err = new Error('Invalid or expired reset token')
      ;(err as NodeJS.ErrnoException).code = 'E_INVALID_RESET_TOKEN'
      throw err
    }

    const user = await User.findOrFail(row.user_id)
    user.password = newPassword
    await user.save()
    await db.from('password_resets').where('user_id', user.id).delete()
  }

  /**
   * Finds an existing user by email or creates one with a random password
   * (Google is the primary sign-in path for that account).
   */
  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<{ user: User; isNew: boolean }> {
    const existing = await User.findBy('email', profile.email)
    if (existing) {
      return { user: existing, isNew: false }
    }

    const randomPassword = await hash.make(randomBytes(48).toString('hex'))
    const user = await User.create({
      email: profile.email,
      fullName: profile.name,
      password: randomPassword,
    })
    return { user, isNew: true }
  }
}
