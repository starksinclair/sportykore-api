import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import OtpService from '#services/otp_service'
import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Player from '#models/player'
import OtpCode from '#models/otp_code'
import Invite from '#models/invite'
import AuthSessionTransformer from '#transformers/auth_session_transformer'
import {
  requestOtpValidator,
  requestRecoveryValidator,
  verifyOtpValidator,
} from '#validators/auth'

@inject()
export default class AuthController {
  constructor(private otpService: OtpService) {}

  async requestOtp({ request, response }: HttpContext) {
    const { email, name, recoveryEmail } = await request.validateUsing(requestOtpValidator)
    const result = await this.otpService.requestOtp(email, name, recoveryEmail)

    if (result.status === 'requires_signup') {
      return response.status(428).send({
        message: 'Name is required to create a new account',
        requiresSignup: true,
      })
    }

    return response.ok({ message: 'OTP sent' })
  }

  async verifyOtp({ request, auth, serialize }: HttpContext) {
    const { email, code } = await request.validateUsing(verifyOtpValidator)
    const { user } = await this.otpService.verifyOtp(email, code)
    const token = await auth.use('api').createToken(user, ['*'], {
      name: 'mobile',
      expiresIn: '30d',
    })
    return serialize({
      auth: AuthSessionTransformer.transform({ user: user, accessToken: token }),
    })
  }

  async requestRecovery({ request, response }: HttpContext) {
    const { recoveryEmail } = await request.validateUsing(requestRecoveryValidator)
    const user = await User.findByOrFail('recoveryEmail', recoveryEmail)

    await this.otpService.requestOtp(user.email)

    return response.ok({
      message: 'Recovery OTP sent to your primary email',
    })
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('api').invalidateToken()
    return response.noContent()
  }

  async deleteAccount({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    await db.transaction(async (trx) => {
      await Player.query({ client: trx }).where('userId', user.id).delete()
      await OtpCode.query({ client: trx }).where('email', user.email).delete()
      await Invite.query({ client: trx }).where('invitedUserId', user.id).update({ invitedUserId: null })
      user.useTransaction(trx)
      await user.delete()
    })

    return response.ok({ message: 'Account deleted successfully' })
  }
}
