import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import {
  forgotPasswordValidator,
  loginValidator,
  resetPasswordValidator,
  signupValidator,
} from '#validators/user'
import UserAuthService from '#services/user_auth_service'
import AuthSessionTransformer from '#transformers/auth_session_transformer'
import WelcomeNotification from '#mails/welcome_notification'
import mail from '@adonisjs/mail/services/main'
import limiter from '@adonisjs/limiter/services/main'
import { inject } from '@adonisjs/core'
import User from '#models/user'

@inject()
export default class UsersController {
  constructor(protected userAuth: UserAuthService) {}
  private readonly MOBILE_TOKEN_EXPIRES = '30d'
  async signup({ request, auth, response, serialize }: HttpContext) {
    const data = await request.validateUsing(signupValidator)
    try {
      const { user, accessToken } = await this.userAuth.registerWithPassword(auth, {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
      })
      await mail.send(new WelcomeNotification(user))
      return response.created(
        await serialize({
          auth: AuthSessionTransformer.transform({ user, accessToken }),
        })
      )
    } catch (error) {
      return this.handleUniqueEmail(error, response)
    }
  }

  async login({ request, auth, response, serialize }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const loginLimiter = limiter.use({
      requests: 5,
      duration: '1 min',
      blockDuration: '20 mins',
    })

    const key = `login_${request.ip()}_${email}`
    try {
      const [error, user] = await loginLimiter.penalize(key, () => {
        return User.verifyCredentials(email, password)
      })
      if (error) {
        return response.tooManyRequests({
          message: `Too many login attempts. Try again in ${error.response.availableIn} seconds`,
        })
      }
      const accessToken = await auth.use('api').createToken(user, ['*'], {
        name: 'mobile',
        expiresIn: this.MOBILE_TOKEN_EXPIRES,
      })

      return response.ok(
        await serialize({
          auth: AuthSessionTransformer.transform({ user, accessToken }),
        })
      )
    } catch (error) {
      if (error instanceof Error && (error as { code?: string }).code === 'E_INVALID_CREDENTIALS') {
        return response.unauthorized({ message: 'Invalid email or password' })
      }
      throw error
    }
  }

  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    await this.userAuth.requestPasswordReset(email)
    return response.noContent()
  }

  async resetPassword({ request, response }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    try {
      await this.userAuth.resetPasswordWithToken(token, password)
      return response.noContent()
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === 'E_INVALID_RESET_TOKEN'
      ) {
        return response.badRequest({ message: 'Invalid or expired reset token' })
      }
      throw error
    }
  }

  async googleRedirect({ ally }: HttpContext) {
    await ally.use('google').redirect()
  }

  async googleCallback({ ally, auth, response, serialize }: HttpContext) {
    const google = ally.use('google')

    if (google.accessDenied()) {
      return response.badRequest({ message: 'Google authorization was denied' })
    }
    if (google.stateMisMatch()) {
      return response.badRequest({ message: 'Invalid OAuth state' })
    }
    if (google.hasError()) {
      return response.badRequest({ message: google.getError() })
    }

    const gUser = await google.user()
    if (!gUser.email) {
      return response.badRequest({ message: 'Google did not return an email for this account' })
    }

    const { user, isNew } = await this.userAuth.findOrCreateFromGoogle({
      email: gUser.email,
      name: gUser.name,
      providerId: gUser.id,
    })
    const accessToken = await auth.use('api').createToken(user, ['*'], {
      name: 'google-mobile',
      expiresIn: '30d',
    })
    if (isNew) {
      await mail.sendLater(new WelcomeNotification(user))
    }

    const deepLink = env.get('MOBILE_OAUTH_DEEP_LINK', '')
    if (deepLink) {
      const authPayload = new AuthSessionTransformer({ user, accessToken }).toObject()
      const url = new URL(deepLink)
      url.searchParams.set('token', authPayload.token.value ?? '')
      url.searchParams.set('tokenType', 'bearer')
      if (authPayload.token.expiresAt) {
        url.searchParams.set('expiresAt', authPayload.token.expiresAt)
      }
      return response.redirect(url.toString())
    }

    return response.ok(
      await serialize({ auth: AuthSessionTransformer.transform({ user, accessToken }) })
    )
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('api').invalidateToken()
    return response.noContent()
  }

  private handleUniqueEmail(error: unknown, response: HttpContext['response']) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('unique') || message.includes('UNIQUE constraint')) {
      return response.conflict({ message: 'Email is already registered' })
    }
    throw error
  }
}
