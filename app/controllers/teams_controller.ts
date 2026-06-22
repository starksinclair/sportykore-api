import type { HttpContext } from '@adonisjs/core/http'
import TeamTransformer from '#transformers/team_transformer'
import TeamLeagueDetailTransformer from '#transformers/team_league_detail_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'
import { TeamService } from '#services/team_service'
import StandingService from '#services/standing_service'
import { inject } from '@adonisjs/core'
import Team from '#models/team'
import Season from '#models/season'
import { createTeamValidator, updateTeamValidator } from '#validators/team'
import string from '@adonisjs/core/helpers/string'
import FileService from '#services/file_service'

@inject()
export default class TeamsController {
  constructor(
    protected teamService: TeamService,
    protected fileService: FileService,
    protected standingService: StandingService
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
      logoUrl = await this.fileService.upload(data.logo, key)
    }
    const team = await Team.create({
      leagueId: data.leagueId,
      addedBy: user.id,
      name: data.name,
      logoUrl: logoUrl ?? null,
    })

    const activeSeason = await Season.query()
      .where('league_id', data.leagueId)
      .where('status', 'active')
      .first()

    if (activeSeason) {
      await this.standingService.ensureForTeams(data.leagueId, activeSeason.id, [team.id])
    }

    return response.created({ message: 'Team created successfully' })
  }

  async update({ params, response, request }: HttpContext) {
    const { id } = params
    const data = await request.validateUsing(updateTeamValidator)
    const team = await Team.findOrFail(id)

    if (data.logo) {
      const key = `teams/${string.uuid()}.${data.logo.extname}`
      team.logoUrl = await this.fileService.upload(data.logo, key)
    }

    const { logo: _logo, ...fields } = data
    team.merge(fields)
    await team.save()
    return response.ok({ message: 'Team updated successfully' })
  }
}
