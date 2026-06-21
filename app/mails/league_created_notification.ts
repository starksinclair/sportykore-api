import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'
import type League from '#models/league'

export default class LeagueCreatedNotification extends BaseMail {
  subject = 'Your league is live! 🏆'

  constructor(
    private user: User,
    private league: League,
    private appUrl: string
  ) {
    super()
  }

  prepare() {
    this.message.to(this.user.email).htmlView('emails/league_created', {
      user: this.user,
      league: this.league,
      appUrl: this.appUrl,
    })
  }
}
