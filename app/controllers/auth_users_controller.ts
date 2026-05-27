import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import { UserManageService } from '#services/user_manage_service'
import OwnedLeagueTransformer from '#transformers/owned_league_transformer'
import TeamTransformer from '#transformers/team_transformer'
import UserTransformer from '#transformers/user_transformer'

@inject()
export default class AuthUsersController {
  constructor(protected userManageService: UserManageService) {}

  async me({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    return serialize(UserTransformer.transform(user))
  }

  async leagues({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const leagues = await this.userManageService.listOwnedLeagues(user.id)
    return serialize(OwnedLeagueTransformer.transform(leagues))
  }

  async teams({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const leagueId = Number(params.leagueId)
    const teams = await this.userManageService.listOwnedLeagueTeams(user.id, leagueId)
    return serialize(TeamTransformer.transform(teams))
  }

  async search({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const query = (request.input('q') ?? '').toString()
    const leagueId = Number(request.input('leagueId'))
    const limit = this.parseLimit(request.input('limit'))

    const users = await this.userManageService.searchUsersForInvite(user.id, leagueId, query, limit)

    return serialize(UserTransformer.transform(users))
  }

  private parseLimit(value: unknown) {
    const parsed = Number(value ?? 20)

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 20
    }

    return Math.min(Math.floor(parsed), 50)
  }
}
