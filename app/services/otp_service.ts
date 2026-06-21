import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import OtpCode from '#models/otp_code'
import User from '#models/user'
import mail from '@adonisjs/mail/services/main'
import OTPNotification from '#mails/otp_notification'
import logger from '@adonisjs/core/services/logger'
import WelcomeNotification from '#mails/welcome_notification'

export type RequestOtpResult =
  | { status: 'otp_sent' }
  | { status: 'requires_signup' }

export default class OtpService {
  /**
   * Generate a 6 digit OTP
   * @returns {Promise<string>} The OTP code
   */
  private async generateCode(): Promise<string> {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Send an OTP to the user's email
   * @param {string} email - The user's email
   * @returns {Promise<{message: string}>} A promise that resolves to a message
   */
  private async sendOtp(email: string): Promise<void> {
    await OtpCode.query().where('email', email).where('is_used', false).update({ isUsed: true })

    const code = await this.generateCode()

    await OtpCode.create({
      email,
      code,
      isUsed: false,
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    })

    logger.info(`OTP sent to ${email}: ${code}`)

    await mail.send(new OTPNotification(email, code))
  }

  /**
   * Request an OTP for login or signup.
   */
  async requestOtp(
    email: string,
    name?: string,
    recoveryEmail?: string
  ): Promise<RequestOtpResult> {
    const existingUser = await User.findBy('email', email)

    if (existingUser) {
      await this.sendOtp(email)
      return { status: 'otp_sent' }
    }

    if (!name) {
      return { status: 'requires_signup' }
    }

    await User.create({
      email,
      fullName: name,
      recoveryEmail: recoveryEmail ?? null,
    })

    await this.sendOtp(email)
    return { status: 'otp_sent' }
  }

  /**
   * Verify an OTP and return the authenticated user.
   */
  async verifyOtp(email: string, code: string): Promise<{ user: User }> {
    const otp = await OtpCode.query()
      .where('email', email)
      .where('code', code)
      .where('is_used', false)
      .where('expires_at', '>', DateTime.now().toSQL())
      .first()

    if (!otp) {
      throw new Exception('Invalid or expired OTP', { status: 401 })
    }

    otp.isUsed = true
    await otp.save()

    const user = await User.findByOrFail('email', email)

    const isNewUser = user.createdAt > DateTime.now().minus({ minutes: 10 })

    if (isNewUser) {
      logger.info(`Sending welcome email to ${email}`)
      await mail.sendLater(new WelcomeNotification(user))
    }

    return { user }
  }
}
