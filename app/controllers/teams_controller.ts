import type { HttpContext } from '@adonisjs/core/http'
import TeamTransformer from '#transformers/team_transformer'
import TeamLeagueDetailTransformer from '#transformers/team_league_detail_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'
import { TeamService } from '#services/team_service'
import StandingService from '#services/standing_service'
import { inject } from '@adonisjs/core'
import Team from '#models/team'
import Season from '#models/season'
import League from '#models/league'
import { createTeamValidator, updateTeamValidator } from '#validators/team'
import FileService from '#services/file_service'
import { teamLogoKey } from '#helpers/storage_paths'

@inject()
export default class TeamsController {
  constructor(
    protected teamService: TeamService,
    protected fileService: FileService,
    protected standingService: StandingService
  ) {}
  async show({ params, serialize }: HttpContext) {
    const { id } = params
    console.log('team id', id)
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
    const league = await League.findOrFail(data.leagueId)
    const team = await Team.create({
      leagueId: data.leagueId,
      addedBy: user.id,
      name: data.name,
      logoUrl: null,
    })

    if (data.logo) {
      team.logoUrl = await this.fileService.upload(
        data.logo,
        teamLogoKey(league, team, data.logo.extname)
      )
      await team.save()
    }

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
    const team = await Team.query()
      .where('id', id)
      .where('league_id', params.leagueId)
      .preload('league')
      .firstOrFail()

    if (data.logo) {
      const pathTeam = { id: team.id, name: data.name ?? team.name }
      team.logoUrl = await this.fileService.upload(
        data.logo,
        teamLogoKey(team.league, pathTeam, data.logo.extname)
      )
    }

    const { logo: logoFile, ...fields } = data
    void logoFile
    team.merge(fields)
    await team.save()
    return response.ok({ message: 'Team updated successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    const team = await Team.query()
      .where('id', params.id)
      .where('league_id', params.leagueId)
      .firstOrFail()

    await team.delete()

    return response.ok({ message: 'Team deleted successfully' })
  }
}
