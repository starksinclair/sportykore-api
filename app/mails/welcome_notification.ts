import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class WelcomeNotification extends BaseMail {
  subject = 'Welcome to Sportykore 🎉'
  from = 'noreply@notifications.sportykore.com'

  constructor(private user: User) {
    super()
  }

  prepare() {
    this.message.to(this.user.email).htmlView('emails/welcome', { user: this.user })
  }
}
