import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'

import LeagueService from '#services/league_service'
import { createLeagueWithSeasonValidator, updateLeagueValidator } from '#validators/league'
import CountryTransformer from '#transformers/country_transformer'
import { inject } from '@adonisjs/core'
import SeasonTransformer from '#transformers/season_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'
import InviteService from '#services/invite_service'
import League from '#models/league'
import string from '@adonisjs/core/helpers/string'
import FileService from '#services/file_service'
import LeagueCreatedNotification from '#mails/league_created_notification'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'

@inject()
export default class LeaguesController {
  constructor(
    protected leagueService: LeagueService,
    protected inviteService: InviteService,
    protected fileService: FileService
  ) {}
  async store({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(createLeagueWithSeasonValidator)
    const user = auth.getUserOrFail()
    let logoUrl: string | null = null

    if (data.logo) {
      const key = `leagues/${string.uuid()}.${data.logo.extname}`
      logoUrl = await this.fileService.upload(data.logo, key)
    }
    const result = await this.leagueService.createWithSeason(user.id, {
      name: data.name,
      description: data.description ?? null,
      gender: data.gender ?? null,
      logoUrl: logoUrl ?? null,
      countryId: data.countryId,
      seasonName: data.seasonName,
      teams: data.teams ?? [],
    })
    const inviteUrl = await this.inviteService.generate(result.league.id, result.season.id)

    const baseUrl = env.get('MOBILE_APP_URL') ?? env.get('APP_URL')
    await mail.sendLater(
      new LeagueCreatedNotification(user, result.league, `${baseUrl}${inviteUrl}`)
    )

    return response.created({ inviteUrl })
  }
  async index({ serialize, request, auth }: HttpContext) {
    const { countryId, gameStatus, gameDate, timeZone } = request.qs()
    const isLoggedIn = await auth.use('api').check()
    const userId = isLoggedIn ? auth.use('api').getUserOrFail().id : undefined

    const [countriesWithLeagues, leagueWithMatchesByCountry] = await Promise.all([
      this.leagueService.listCountriesWithLeagues(countryId),
      this.leagueService.listLeagueByCountry(countryId, gameStatus, gameDate, timeZone, userId),
    ])

    return serialize({
      leagues: CountryTransformer.transform(countriesWithLeagues),
      matches: CountryTransformer.transform(leagueWithMatchesByCountry, userId)?.useVariant(
        'WithFavourites'
      ),
    })
  }
  async show({ params, serialize, request }: HttpContext) {
    const leagueId = Number(params.leagueId)
    const seasonIdRaw = request.qs().seasonId
    const seasonId =
      seasonIdRaw !== undefined && seasonIdRaw !== '' ? Number(seasonIdRaw) : undefined

    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      throw new Exception('Invalid league id', { status: 400 })
    }
    if (seasonId !== undefined && (!Number.isFinite(seasonId) || seasonId <= 0)) {
      throw new Exception('Invalid season id', { status: 400 })
    }

    const { seasons, season, statTypes } = await this.leagueService.getLeague(leagueId, seasonId)

    return serialize({
      seasons: SeasonTransformer.transform(seasons),
      season: SeasonTransformer.transform(season),
      statTypes: StatTypeTransformer.transform(statTypes),
    })
  }

  async update({ params, response, request }: HttpContext) {
    const leagueId = Number(params.leagueId)
    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      throw new Exception('Invalid league id', { status: 400 })
    }
    const data = await request.validateUsing(updateLeagueValidator)
    const league = await League.findOrFail(leagueId)
    league.merge(data)
    await league.save()
    return response.ok({ message: 'League updated successfully' })
  }
}
