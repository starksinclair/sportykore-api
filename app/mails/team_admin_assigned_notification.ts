import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'
import type Team from '#models/team'
import type League from '#models/league'

export default class TeamAdminAssignedNotification extends BaseMail {
  subject = "You've been made a team admin for {team.name} on SportyKore"

  constructor(
    private assignee: User,
    private assigner: User,
    private team: Team,
    private league: League,
    private appUrl: string
  ) {
    super()
  }

  prepare() {
    this.message.to(this.assignee.email).htmlView('emails/team_admin_assigned', {
      assignee: this.assignee,
      assigner: this.assigner,
      team: this.team,
      league: this.league,
      appUrl: this.appUrl,
    })
  }
}
