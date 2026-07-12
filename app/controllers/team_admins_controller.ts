import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import TeamAdminService from '#services/team_admin_service'
import { assignTeamAdminValidator } from '#validators/team_admin'

@inject()
export default class TeamAdminsController {
  constructor(protected teamAdminService: TeamAdminService) {}

  async store({ params, request, response, auth }: HttpContext) {
    const { userId } = await request.validateUsing(assignTeamAdminValidator)

    await this.teamAdminService.assign(
      Number(params.leagueId),
      Number(params.teamId),
      userId,
      auth.getUserOrFail().id
    )

    return response.created({ message: 'Team admin assigned successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    await this.teamAdminService.remove(
      Number(params.leagueId),
      Number(params.teamId),
      Number(params.userId)
    )

    return response.ok({ message: 'Team admin removed successfully' })
  }
}
