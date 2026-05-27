import { Exception } from '@adonisjs/core/exceptions'

import League from '#models/league'
import Team from '#models/team'
import User from '#models/user'

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

      return Object.assign(league, { activeSeason })
    })
  }

  async listOwnedLeagueTeams(userId: number, leagueId: number) {
    const league = await League.query().where('id', leagueId).where('user_id', userId).first()

    if (!league) {
      throw new Exception('You are not authorized to manage this league', { status: 403 })
    }

    return Team.query().where('league_id', leagueId).orderBy('name', 'asc')
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
