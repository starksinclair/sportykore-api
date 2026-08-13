import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'

import { resolveRequestTimeZone } from '#helpers/time_zone'
import LeagueService from '#services/league_service'
import { createLeagueWithSeasonValidator, updateLeagueValidator } from '#validators/league'
import CountryTransformer from '#transformers/country_transformer'
import { inject } from '@adonisjs/core'
import SeasonTransformer from '#transformers/season_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'
import League from '#models/league'
import FileService from '#services/file_service'
import LeagueCreatedNotification from '#mails/league_created_notification'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import { leagueLogoKey, teamLogoKey } from '#helpers/storage_paths'

function parseJsonField(value: unknown) {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function normalizeTeamFields(body: Record<string, unknown>, request: HttpContext['request']) {
  const teamsInput = parseJsonField(request.input('teams'))
  if (Array.isArray(teamsInput)) return teamsInput

  const byIndex = new Map<number, Record<string, unknown>>()

  for (const [key, value] of Object.entries(body)) {
    const match = /^teams(?:\.|\[)(\d+)(?:\.|\]\[)(name|logo)\]?$/.exec(key)
    if (!match) continue

    const index = Number(match[1])
    const field = match[2]
    const team = byIndex.get(index) ?? {}
    team[field] = value
    byIndex.set(index, team)
  }

  for (const index of byIndex.keys()) {
    const team = byIndex.get(index)!
    const logo =
      request.file(`teams.${index}.logo`) ??
      request.file(`teams[${index}][logo]`) ??
      request.file(`teams[${index}].logo`)

    if (logo) {
      team.logo = logo
    }
  }

  return byIndex.size
    ? [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, team]) => team)
    : teamsInput
}

@inject()
export default class LeaguesController {
  constructor(
    protected leagueService: LeagueService,
    protected fileService: FileService
  ) {}
  async store({ auth, request, response }: HttpContext) {
    const body = request.body()
    request.updateBody({
      ...body,
      knockout: parseJsonField(request.input('knockout')),
      group: parseJsonField(request.input('group')),
      teams: normalizeTeamFields(body, request),
    })
    const data = await request.validateUsing(createLeagueWithSeasonValidator)
    const user = auth.getUserOrFail()
    const teamInputs = data.teams ?? []

    const result = await this.leagueService.createWithSeason(user.id, {
      name: data.name,
      description: data.description ?? null,
      gender: data.gender ?? null,
      logoUrl: null,
      countryId: data.countryId,
      seasonName: data.seasonName,
      tiebreaker: data.tiebreaker,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      teams: teamInputs.map((team) => ({ name: team.name, logoUrl: null })),
      format: data.format,
      knockout: data.knockout
        ? {
            name: data.knockout.name,
            seed: data.knockout.seed,
            config: {
              format: {
                starting_round: data.knockout.config.format?.starting_round,
                has_third_place: data.knockout.config.format?.has_third_place ?? false,
              },
              ties: data.knockout.config.ties,
            },
          }
        : undefined,
      group: data.group
        ? {
            name: data.group.name,
            config: data.group.config,
          }
        : undefined,
    })

    if (data.logo) {
      result.league.logoUrl = await this.fileService.upload(
        data.logo,
        leagueLogoKey(result.league, data.logo.extname)
      )
      await result.league.save()
    }

    await Promise.all(
      teamInputs.map(async (teamInput, index) => {
        if (!teamInput.logo) return
        const team = result.teams[index]
        if (!team) return
        team.logoUrl = await this.fileService.upload(
          teamInput.logo,
          teamLogoKey(result.league, team, teamInput.logo.extname)
        )
        await team.save()
      })
    )

    const baseUrl = env.get('MOBILE_APP_URL') ?? env.get('APP_URL')
    await mail.send(new LeagueCreatedNotification(user, result.league, `${baseUrl}`))

    return response.created({
      message: 'League created successfully',
      leagueId: result.league.id,
      seasonId: result.season.id,
      stageId: result.stage.id,
      format: result.format,
      seeded: result.seeded,
    })
  }
  async index({ serialize, request, auth }: HttpContext) {
    const { countryId, gameStatus, gameDate, timeZone: timeZoneQuery } = request.qs()
    const timeZone = resolveRequestTimeZone(timeZoneQuery, request)
    const matchDay = this.leagueService.resolveMatchDayContext(gameDate, timeZone)
    const isLoggedIn = await auth.use('api').check()
    const userId = isLoggedIn ? auth.use('api').getUserOrFail().id : undefined

    const [countriesWithLeagues, leagueWithMatchesByCountry] = await Promise.all([
      this.leagueService.listCountriesWithLeagues(countryId, userId),
      this.leagueService.listLeagueByCountry(
        countryId,
        gameStatus,
        matchDay.gameDate,
        matchDay.timeZone,
        userId
      ),
    ])

    const transformedLeagues = userId
      ? CountryTransformer.transform(countriesWithLeagues, userId)?.useVariant('WithFavourites')
      : CountryTransformer.transform(countriesWithLeagues)

    return serialize({
      matchDay: { gameDate: matchDay.gameDate, timeZone: matchDay.timeZone },
      leagues: transformedLeagues,
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
    const tiebreakerChanged = data.tiebreaker !== undefined && data.tiebreaker !== league.tiebreaker

    if (data.logo) {
      const pathLeague = { id: league.id, name: data.name ?? league.name }
      league.logoUrl = await this.fileService.upload(
        data.logo,
        leagueLogoKey(pathLeague, data.logo.extname)
      )
    }

    const { logo: logo, ...fields } = data
    league.merge(fields)
    await league.save()

    if (tiebreakerChanged) {
      await this.leagueService.resortStandingsForLeague(leagueId)
    }

    return response.ok({ message: 'League updated successfully' })
  }
}
