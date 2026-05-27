import type { HttpContext } from '@adonisjs/core/http'
import TeamTransformer from '#transformers/team_transformer'
import TeamLeagueDetailTransformer from '#transformers/team_league_detail_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'
import { TeamService } from '#services/team_service'
import { inject } from '@adonisjs/core'
import Team from '#models/team'
import { createTeamValidator, updateTeamValidator } from '#validators/team'
import string from '@adonisjs/core/helpers/string'
import FileService from '#services/file_service'

@inject()
export default class TeamsController {
  constructor(
    protected teamService: TeamService,
    protected fileService: FileService
  ) {}
  async show({ params, serialize }: HttpContext) {
    const { id } = params
    const { team, leagues, statTypes } = await this.teamService.getTeamDetail(Number(id))

    return serialize({
      team: TeamTransformer.transform(team),
      leagues: TeamLeagueDetailTransformer.transform(leagues)?.depth(5),
      statTypes: StatTypeTransformer.transform(statTypes),
    })
  }

  async store({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(createTeamValidator)
    let logoUrl: string | null = null

    if (data.logo) {
      const key = `teams/${string.uuid()}.${data.logo.extname}`
      logoUrl = await this.fileService.upload(data.logo, key, 'fs')
    }
    await Team.create({
      leagueId: data.leagueId,
      addedBy: user.id,
      name: data.name,
      logoUrl: logoUrl ?? null,
    })
    return response.created({ message: 'Team created successfully' })
  }

  async update({ params, response, request }: HttpContext) {
    const { id } = params
    const data = await request.validateUsing(updateTeamValidator)
    const team = await Team.findOrFail(id)
    team.merge(data)
    await team.save()
    return response.ok({ message: 'Team updated successfully' })
  }
}
