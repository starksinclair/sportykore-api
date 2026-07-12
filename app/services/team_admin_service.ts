import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'

import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import User from '#models/user'
import TeamAdminAssignedNotification from '#mails/team_admin_assigned_notification'

export default class TeamAdminService {
  async assign(leagueId: number, teamId: number, userId: number, assignedBy: number) {
    const team = await Team.query()
      .where('id', teamId)
      .where('league_id', leagueId)
      .preload('league')
      .firstOrFail()

    const existing = await TeamAdmin.query()
      .where('team_id', teamId)
      .where('user_id', userId)
      .first()

    let admin: TeamAdmin

    if (existing) {
      if (!existing.removedAt) {
        throw new Exception('User is already a team admin for this team', { status: 409 })
      }

      existing.removedAt = null
      existing.assignedBy = assignedBy
      existing.leagueId = leagueId
      await existing.save()
      admin = existing
    } else {
      admin = await TeamAdmin.create({
        leagueId,
        teamId,
        userId,
        assignedBy,
      })
    }

    const [assignee, assigner] = await Promise.all([
      User.findOrFail(userId),
      User.findOrFail(assignedBy),
    ])

    const baseUrl = env.get('MOBILE_APP_URL') ?? env.get('APP_URL')
    await mail.send(
      new TeamAdminAssignedNotification(assignee, assigner, team, team.league, `${baseUrl}`)
    )

    return admin
  }

  async remove(leagueId: number, teamId: number, userId: number) {
    await Team.query().where('id', teamId).where('league_id', leagueId).firstOrFail()

    const admin = await TeamAdmin.query()
      .where('team_id', teamId)
      .where('user_id', userId)
      .where('league_id', leagueId)
      .whereNull('removed_at')
      .firstOrFail()

    admin.removedAt = DateTime.utc()
    await admin.save()
  }
}
