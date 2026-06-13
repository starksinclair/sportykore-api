import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import InviteService from '#services/invite_service'
import { completeProfileAndAcceptValidator, generateInviteValidator } from '#validators/invite'

@inject()
export default class InvitesController {
  constructor(private inviteService: InviteService) {}

  async generate({ request, response }: HttpContext) {
    const { leagueId, seasonId, teamId, invitedUserId } =
      await request.validateUsing(generateInviteValidator)

    const link = await this.inviteService.generate(leagueId, seasonId, teamId, invitedUserId)

    return response.ok({ inviteLink: link })
  }

  async accept({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const result = await this.inviteService.accept(params.token, user.id)

    if (result.requiresProfile) {
      return response.ok({ requiresProfile: true, token: params.token })
    }

    return response.ok({ requiresProfile: false, leagueId: result.leagueId })
  }

  async completeProfileAndAccept({ params, request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(completeProfileAndAcceptValidator)

    const result = await this.inviteService.completeProfileAndAccept(params.token, user.id, {
      name: data.name,
      countryId: data.countryId,
      bio: data.bio,
      avatar: data.avatar,
    })

    return response.ok({ leagueId: result.leagueId })
  }
}
