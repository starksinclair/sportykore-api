import { BaseMail } from '@adonisjs/mail'

export default class OTPNotification extends BaseMail {
  subject: string
  from = 'Sportykore <app@notifications.sportykore.com>'

  constructor(
    private email: string,
    private code: string
  ) {
    super()
    this.subject = `${this.code} is your Sportykore login code`
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/otp', { code: this.code })
  }
}
