import { Exception } from '@adonisjs/core/exceptions'

import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import User from '#models/user'

export type AdminTeamManagedResource = Team & {
  league: League
  activeSeason: Season | null
  role: 'team_admin'
}

export class UserManageService {
  async listOwnedLeagues(userId: number) {
    const leagues = await League.query()
      .where('user_id', userId)
      .preload('seasons', (seasonQuery) => {
        seasonQuery.orderByRaw(
          `CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, created_at DESC`
        )
      })
      .orderBy('name', 'asc')

    return leagues.map((league) => {
      const activeSeason =
        league.seasons.find((season) => season.status === 'active') ?? league.seasons[0] ?? null

      return Object.assign(league, { activeSeason, role: 'owner' as const })
    })
  }

  async listManaged(userId: number) {
    const ownedLeagues = await this.listOwnedLeagues(userId)
    const ownedLeagueIds = new Set(ownedLeagues.map((league) => league.id))

    const adminRows = await TeamAdmin.query()
      .where('user_id', userId)
      .whereNull('removed_at')
      .preload('team')
      .preload('league', (leagueQuery) => {
        leagueQuery.preload('seasons', (seasonQuery) => {
          seasonQuery.orderByRaw(
            `CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, created_at DESC`
          )
        })
      })
      .orderBy('id', 'asc')

    const adminTeams: AdminTeamManagedResource[] = []

    for (const row of adminRows) {
      if (ownedLeagueIds.has(row.leagueId)) {
        continue
      }

      const activeSeason =
        row.league.seasons.find((season) => season.status === 'active') ??
        row.league.seasons[0] ??
        null

      adminTeams.push(
        Object.assign(row.team, {
          league: row.league,
          activeSeason,
          role: 'team_admin' as const,
        })
      )
    }

    return { ownedLeagues, adminTeams }
  }

  async listOwnedLeagueTeams(userId: number, leagueId: number) {
    const league = await League.query().where('id', leagueId).where('user_id', userId).first()

    if (!league) {
      throw new Exception('You are not authorized to manage this league', { status: 403 })
    }

    return Team.query()
      .where('league_id', leagueId)
      .preload('admins', (adminsQuery) => {
        adminsQuery.whereNull('removed_at').preload('user').orderBy('id', 'asc')
      })
      .orderBy('name', 'asc')
  }

  async searchUsersForInvite(userId: number, leagueId: number, query: string, limit: number) {
    const league = await League.query().where('id', leagueId).where('user_id', userId).first()

    if (!league) {
      throw new Exception('You are not authorized to manage this league', { status: 403 })
    }

    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    const like = `%${trimmed.toLowerCase()}%`

    return User.query()
      .where((userQuery) => {
        userQuery
          .whereRaw('LOWER(email) LIKE ?', [like])
          .orWhereRaw('LOWER(full_name) LIKE ?', [like])
      })
      .orderBy('full_name', 'asc')
      .limit(limit)
  }
}
