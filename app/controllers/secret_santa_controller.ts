import crypto from 'node:crypto'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import string from '@adonisjs/core/helpers/string'
import { DateTime } from 'luxon'

import CoachProfile from '#models/coach_profile'
import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import Season from '#models/season'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import User from '#models/user'
import Venue from '#models/venue'
import FileService from '#services/file_service'
import LeagueService, { type CompetitionFormat } from '#services/league_service'
import StageService from '#services/stage_service'
import StandingService from '#services/standing_service'
import { leagueLogoKey, teamLogoKey } from '#helpers/storage_paths'
import { SECRET_SANTA_SESSION_KEY } from '#middleware/secret_santa_auth_middleware'
import type { PlayerPosition } from '#types/player'
import { DEFAULT_LEAGUE_TIEBREAKER } from '#types/tiebreaker'

const SESSION_KEY = SECRET_SANTA_SESSION_KEY
const MAX_LOGO_BYTES = 10 * 1024 * 1024
const LOGO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

/** Constant-time password comparison — a plain `!==` leaks timing info. */
function passwordsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // still run a comparison of equal length to avoid a length-based timing signal
    crypto.timingSafeEqual(a, a)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

type DashboardStat = {
  label: string
  value: number
  detail: string
}

type CountryOption = {
  id: number
  name: string
  code: string
}

type LeagueOption = {
  id: number
  name: string
  country: string
  teamCount: number
  seasonLabel: string
}

type UserOption = {
  id: number
  name: string
  email: string
  phone: string | null
  recoveryEmail?: string | null
  leagueCount: number
}

type TeamLogoInput = {
  name: string
  logo: MultipartFile | null
}

type ImportTeamOption = {
  id: number
  name: string
  leagueId: number
  leagueName: string
}

type UserDetail = {
  user: UserOption & {
    createdAt: string
    updatedAt: string
  }
  leagues: LeagueOption[]
  counts: {
    leagues: number
    teamsAdded: number
    notifications: number
  }
}

type CompetitionDetail = {
  league: {
    id: number
    name: string
    description: string | null
    gender: string | null
    countryId: number | null
    userId: number
    logoUrl: string | null
    startDate: string
    endDate: string
    tiebreaker: string
  }
  owner: UserOption | null
  seasons: Array<{ id: number; name: string; status: string }>
  teams: Array<{ id: number; name: string; logoUrl: string | null; playerCount: number }>
  venues: Array<{
    id: number
    name: string
    address: string | null
    city: string | null
    capacity: number | null
    notes: string | null
  }>
  counts: {
    games: number
    players: number
    venues: number
    teams: number
  }
}

type DashboardTab =
  | 'overview'
  | 'users'
  | 'competitions'
  | 'imports'
  | 'onboard'
  | 'teams'
  | 'venues'

type AdminDashboardData = {
  stats: DashboardStat[]
  countries: CountryOption[]
  leagues: LeagueOption[]
  users: UserOption[]
  importTeams: ImportTeamOption[]
  selectedUser: UserDetail | null
  selectedCompetition: CompetitionDetail | null
  tab: DashboardTab
  notice?: string
  error?: string
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeTab(value: unknown): DashboardTab {
  const tab = String(value ?? 'overview')
  return ['overview', 'users', 'competitions', 'imports', 'onboard', 'teams', 'venues'].includes(tab)
    ? (tab as DashboardTab)
    : 'overview'
}

function getCount(row: Record<string, unknown> | null | undefined): number {
  const total = row?.total ?? row?.count ?? 0
  const parsed = Number(total)
  return Number.isFinite(parsed) ? parsed : 0
}

export default class SecretSantaController {
  private fileService = new FileService()

  async index({ request, response, session }: HttpContext) {
    if (session.get(SESSION_KEY) !== true) {
      return response.type('html').send(this.renderLogin())
    }

    const tab = safeTab(request.input('tab'))
    const selectedUserId = this.optionalPositiveInt(request.input('userId'))
    const selectedLeagueId = this.optionalPositiveInt(request.input('leagueId'))
    const [stats, countries, leagues, users, importTeams] = await Promise.all([
      this.dashboardStats(),
      this.countryOptions(),
      this.leagueOptions(),
      this.userOptions(),
      this.importTeamOptions(),
    ])
    const [selectedUser, selectedCompetition] = await Promise.all([
      tab === 'users' ? this.userDetail(selectedUserId ?? users[0]?.id ?? null) : null,
      tab === 'competitions'
        ? this.competitionDetail(selectedLeagueId ?? leagues[0]?.id ?? null)
        : null,
    ])

    return response.type('html').send(
      this.renderDashboard({
        stats,
        countries,
        leagues,
        users,
        importTeams,
        selectedUser,
        selectedCompetition,
        tab,
        notice: this.readOptionalString(request.input('notice')),
        error: this.readOptionalString(request.input('error')),
      })
    )
  }

  async login({ request, response, session }: HttpContext) {
    const expectedPassword = env.get('SECRET_SANTA_PASSWORD')

    if (!expectedPassword) {
      return response
        .status(503)
        .type('html')
        .send(this.renderLogin('SECRET_SANTA_PASSWORD is not set.'))
    }

    if (!passwordsMatch(String(request.input('password') ?? ''), expectedPassword)) {
      return response.status(401).type('html').send(this.renderLogin('Wrong password. Try again.'))
    }

    session.put(SESSION_KEY, true)
    return response.redirect('/secret-santa')
  }

  async logout({ response, session }: HttpContext) {
    session.forget(SESSION_KEY)
    return response.redirect('/secret-santa')
  }

  async createUser({ request, response }: HttpContext) {
    try {
      const email = this.requiredString(request.input('email'), 'Email').toLowerCase()
      const fullName = this.requiredString(request.input('fullName'), 'Full name')
      const phone = this.readOptionalString(request.input('phone')) ?? null
      const recoveryEmail = this.readOptionalString(request.input('recoveryEmail'))?.toLowerCase() ?? null

      const user = await User.updateOrCreate(
        { email },
        {
          email,
          fullName,
          phone,
          recoveryEmail,
        }
      )

      return response.redirect(
        `/secret-santa?tab=users&notice=${encodeURIComponent(
          `Saved ${user.fullName ?? user.email}. You can now assign competitions to this user.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=users&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async updateUser({ params, request, response }: HttpContext) {
    try {
      const user = await User.findOrFail(Number(params.id))
      user.email = this.requiredString(request.input('email'), 'Email').toLowerCase()
      user.fullName = this.requiredString(request.input('fullName'), 'Full name')
      user.phone = this.readOptionalString(request.input('phone')) ?? null
      user.recoveryEmail = this.readOptionalString(request.input('recoveryEmail'))?.toLowerCase() ?? null
      await user.save()

      return response.redirect(
        `/secret-santa?tab=users&userId=${user.id}&notice=${encodeURIComponent(
          `Updated ${user.fullName ?? user.email}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=users&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async onboardCompetition({ request, response }: HttpContext) {
    try {
      const ownerId = this.safePositiveInt(request.input('ownerId'), 'Owner')
      const countryId = this.safePositiveInt(request.input('countryId'), 'Country')
      const name = this.requiredString(request.input('name'), 'Competition name')
      const seasonName = this.requiredString(request.input('seasonName'), 'Season name')
      const format = this.safeFormat(request.input('format'))
      const teamInputs = this.teamLogoInputs(request, 'team')
      const teamNames = teamInputs.map((team) => team.name)
      const venueRows = this.parseVenueLines(request.input('venues'))
      const leagueLogo = this.logoFile(request, 'logo')

      const owner = await User.findOrFail(ownerId)

      const leagueService = new LeagueService(new StandingService())
      const result = await leagueService.createWithSeason(owner.id, {
        name,
        description: this.readOptionalString(request.input('description')),
        gender: this.readOptionalString(request.input('gender')),
        countryId,
        seasonName,
        tiebreaker: DEFAULT_LEAGUE_TIEBREAKER,
        startDate: this.optionalDate(request.input('startDate')),
        endDate: this.optionalDate(request.input('endDate')),
        teams: teamInputs.map((team) => ({ name: team.name, logoUrl: null })),
        format,
        knockout:
          format === 'knockout'
            ? {
                name: 'Knockout',
                seed: teamNames.length >= 2,
                config: {
                  format: { has_third_place: false },
                  ties: { default: { tie_format: 'single' } },
                },
              }
            : undefined,
        group:
          format === 'group'
            ? {
                name: this.readOptionalString(request.input('groupName')) ?? 'Group Stage',
                config: {
                  format: {
                    group_count: this.safePositiveInt(request.input('groupCount'), 'Group count'),
                    double_round_robin: request.input('doubleRoundRobin') === 'on',
                  },
                  advancement: {
                    per_group: this.safePositiveInt(
                      request.input('advancementPerGroup'),
                      'Advancement per group'
                    ),
                  },
                },
              }
            : undefined,
      })

      if (leagueLogo) {
        result.league.logoUrl = await this.fileService.upload(
          leagueLogo,
          leagueLogoKey(result.league, leagueLogo.extname)
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

      await this.createVenues(result.league.id, owner.id, venueRows)

      return response.redirect(
        `/secret-santa?tab=onboard&notice=${encodeURIComponent(
          `Created ${result.league.name} with ${result.teams.length} team${result.teams.length === 1 ? '' : 's'}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=onboard&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async updateCompetition({ params, request, response }: HttpContext) {
    try {
      const league = await League.findOrFail(Number(params.id))
      league.userId = this.safePositiveInt(request.input('ownerId'), 'Owner')
      league.countryId = this.safePositiveInt(request.input('countryId'), 'Country')
      league.name = this.requiredString(request.input('name'), 'Competition name')
      league.description = this.readOptionalString(request.input('description')) ?? null
      league.gender = this.readOptionalString(request.input('gender')) ?? null
      league.logoUrl = this.readOptionalString(request.input('logoUrl')) ?? null
      const logo = this.logoFile(request, 'logo')
      if (logo) {
        const pathLeague = { id: league.id, name: league.name }
        league.logoUrl = await this.fileService.upload(logo, leagueLogoKey(pathLeague, logo.extname))
      }
      league.startDate = this.optionalDate(request.input('startDate'))
      league.endDate = this.optionalDate(request.input('endDate'))
      league.tiebreaker = this.readOptionalString(request.input('tiebreaker')) ?? DEFAULT_LEAGUE_TIEBREAKER
      await league.save()

      return response.redirect(
        `/secret-santa?tab=competitions&leagueId=${league.id}&notice=${encodeURIComponent(
          `Updated ${league.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=competitions&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async updateSeason({ params, request, response }: HttpContext) {
    try {
      const season = await Season.findOrFail(Number(params.id))
      season.name = this.requiredString(request.input('name'), 'Season name')
      season.status = this.requiredString(request.input('status'), 'Season status')
      await season.save()

      return response.redirect(
        `/secret-santa?tab=competitions&leagueId=${season.leagueId}&notice=${encodeURIComponent(
          `Updated ${season.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=competitions&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async addTeams({ request, response }: HttpContext) {
    try {
      const leagueId = this.safePositiveInt(request.input('leagueId'), 'League')
      const teamInputs = this.teamLogoInputs(request, 'team')
      if (teamInputs.length === 0) {
        throw new Error('Add at least one team name.')
      }

      const league = await League.findOrFail(leagueId)
      const teams = await Team.createMany(
        teamInputs.map((team) => ({
          leagueId: league.id,
          addedBy: league.userId,
          name: team.name,
          logoUrl: null,
        }))
      )

      await Promise.all(
        teamInputs.map(async (teamInput, index) => {
          if (!teamInput.logo) return
          const team = teams[index]
          if (!team) return

          team.logoUrl = await this.fileService.upload(
            teamInput.logo,
            teamLogoKey(league, team, teamInput.logo.extname)
          )
          await team.save()
        })
      )

      const activeSeason = await league.related('seasons').query().where('status', 'active').first()
      if (activeSeason) {
        await new StandingService().ensureForTeams(
          league.id,
          activeSeason.id,
          teams.map((team) => team.id)
        )
      }

      return response.redirect(
        `/secret-santa?tab=teams&notice=${encodeURIComponent(
          `Added ${teams.length} team${teams.length === 1 ? '' : 's'} to ${league.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=teams&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async updateTeam({ params, request, response }: HttpContext) {
    try {
      const team = await Team.findOrFail(Number(params.id))
      team.name = this.requiredString(request.input('name'), 'Team name')
      team.logoUrl = this.readOptionalString(request.input('logoUrl')) ?? null
      const logo = this.logoFile(request, 'logo')
      if (logo) {
        const league = await League.findOrFail(team.leagueId)
        team.logoUrl = await this.fileService.upload(
          logo,
          teamLogoKey(league, team, logo.extname)
        )
      }
      await team.save()

      return response.redirect(
        `/secret-santa?tab=competitions&leagueId=${team.leagueId}&notice=${encodeURIComponent(
          `Updated ${team.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=competitions&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async addVenues({ request, response }: HttpContext) {
    try {
      const leagueId = this.safePositiveInt(request.input('leagueId'), 'League')
      const league = await League.findOrFail(leagueId)
      const venues = await this.createVenues(
        league.id,
        league.userId,
        this.parseVenueLines(request.input('venues'))
      )

      return response.redirect(
        `/secret-santa?tab=venues&notice=${encodeURIComponent(
          `Added ${venues.length} venue${venues.length === 1 ? '' : 's'} to ${league.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=venues&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async updateVenue({ params, request, response }: HttpContext) {
    try {
      const venue = await Venue.findOrFail(Number(params.id))
      venue.name = this.requiredString(request.input('name'), 'Venue name')
      venue.address = this.readOptionalString(request.input('address')) ?? null
      venue.city = this.readOptionalString(request.input('city')) ?? null
      venue.capacity = this.optionalNumber(request.input('capacity'))
      venue.notes = this.readOptionalString(request.input('notes')) ?? null
      await venue.save()

      return response.redirect(
        `/secret-santa?tab=competitions&leagueId=${venue.leagueId}&notice=${encodeURIComponent(
          `Updated ${venue.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=competitions&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async importPlayers({ request, response }: HttpContext) {
    try {
      const leagueId = this.safePositiveInt(request.input('leagueId'), 'League')
      const league = await League.findOrFail(leagueId)
      const season = await this.resolveSeason(league.id, this.optionalPositiveInt(request.input('seasonId')))
      const teamMap = await this.teamMap(league.id)
      const rows = this.parsePipeRows(request.input('players'), ['team', 'jersey', 'name', 'position'])
      if (rows.length === 0) throw new Error('Paste at least one player row.')

      let imported = 0
      for (const row of rows) {
        const team = this.requiredTeam(teamMap, row.team)
        const name = this.requiredString(row.name, 'Player name')
        const existing = await this.findExistingPlayerMembership({
          leagueId: league.id,
          seasonId: season.id,
          teamId: team.id,
          name,
          jerseyNumber: row.jersey,
        })
        const player =
          existing ??
          (await this.createImportedPlayer({
            name,
            position: this.normalizePosition(row.position),
            league,
          }))

        await LeaguePlayer.updateOrCreate(
          {
            playerId: player.id,
            leagueId: league.id,
            seasonId: season.id,
          },
          {
            teamId: team.id,
            joinedAt: DateTime.now(),
            status: 'active',
            position: this.normalizePosition(row.position),
            jerseyNumber: this.readOptionalString(row.jersey) ?? null,
            isCaptain: false,
          }
        )
        imported += 1
      }

      return response.redirect(
        `/secret-santa?tab=imports&notice=${encodeURIComponent(
          `Imported ${imported} player${imported === 1 ? '' : 's'} into ${league.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=imports&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async importStaff({ request, response }: HttpContext) {
    try {
      const leagueId = this.safePositiveInt(request.input('leagueId'), 'League')
      const league = await League.findOrFail(leagueId)
      const teamMap = await this.teamMap(league.id)
      const rows = this.parsePipeRows(request.input('staff'), ['team', 'name', 'role', 'department'])
      if (rows.length === 0) throw new Error('Paste at least one staff row.')

      let imported = 0
      for (const row of rows) {
        const team = this.requiredTeam(teamMap, row.team)
        const name = this.requiredString(row.name, 'Staff name')
        const role = this.readOptionalString(row.role) ?? 'Coach'
        const email = this.importEmail('coach', `${league.id}-${team.id}-${name}`)
        const user = await User.updateOrCreate({ email }, { email, fullName: name })
        await CoachProfile.updateOrCreate(
          { userId: user.id },
          {
            userId: user.id,
            displayName: name,
            bio: this.readOptionalString(row.department),
            experience: role,
            qualifications: null,
            philosophy: null,
            photoUrl: null,
            countryId: league.countryId,
            city: null,
            state: null,
            availability: 'not_open',
            visibility: 'public',
          }
        )
        await TeamAdmin.updateOrCreate(
          { userId: user.id, leagueId: league.id, teamId: team.id },
          {
            userId: user.id,
            leagueId: league.id,
            teamId: team.id,
            assignedBy: league.userId,
            removedAt: null,
          }
        )
        imported += 1
      }

      return response.redirect(
        `/secret-santa?tab=imports&notice=${encodeURIComponent(
          `Imported ${imported} staff profile${imported === 1 ? '' : 's'} into ${league.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=imports&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  async importGames({ request, response }: HttpContext) {
    try {
      const leagueId = this.safePositiveInt(request.input('leagueId'), 'League')
      const league = await League.findOrFail(leagueId)
      const season = await this.resolveSeason(league.id, this.optionalPositiveInt(request.input('seasonId')))
      const stage = await new StageService().ensureRoundRobinStage(season.id)
      const teamMap = await this.teamMap(league.id)
      const rows = this.parsePipeRows(request.input('games'), [
        'playedAt',
        'home',
        'away',
        'venue',
        'status',
        'homeScore',
        'awayScore',
        'round',
      ])
      if (rows.length === 0) throw new Error('Paste at least one game row.')

      let imported = 0
      for (const row of rows) {
        const homeTeam = this.requiredTeam(teamMap, row.home)
        const awayTeam = this.requiredTeam(teamMap, row.away)
        const playedAt = this.requiredDateTime(row.playedAt)
        const venue = await this.findOrCreateVenue(league, row.venue)
        const status = this.readOptionalString(row.status) ?? 'scheduled'
        const homeScore = this.optionalNumber(row.homeScore)
        const awayScore = this.optionalNumber(row.awayScore)
        const playedAtSql = playedAt.toSQL() ?? playedAt.toISO() ?? playedAt.toFormat('yyyy-MM-dd HH:mm:ss')
        const game = await Game.query()
          .where('league_id', league.id)
          .where('season_id', season.id)
          .where('home_team_id', homeTeam.id)
          .where('away_team_id', awayTeam.id)
          .where('played_at', playedAtSql)
          .first()

        const payload = {
          leagueId: league.id,
          seasonId: season.id,
          stageId: stage.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          playedAt,
          status,
          homeScore,
          awayScore,
          venueId: venue?.id ?? null,
          venueName: venue?.name ?? this.readOptionalString(row.venue) ?? null,
          round: this.readOptionalString(row.round) ?? null,
          firstHalfDuration: 45,
          secondHalfDuration: 45,
          extraTimeDuration: null,
        }

        if (game) {
          game.merge(payload)
          await game.save()
        } else {
          await Game.create(payload)
        }
        imported += 1
      }

      return response.redirect(
        `/secret-santa?tab=imports&notice=${encodeURIComponent(
          `Imported ${imported} fixture${imported === 1 ? '' : 's'} into ${league.name}.`
        )}`
      )
    } catch (error) {
      return response.redirect(
        `/secret-santa?tab=imports&error=${encodeURIComponent(this.errorMessage(error))}`
      )
    }
  }

  private async dashboardStats(): Promise<DashboardStat[]> {
    const [users, leagues, teams, players, coaches, games, venues] = await Promise.all([
      this.countTable('users'),
      this.countTable('leagues'),
      this.countTable('teams'),
      this.countTable('players'),
      this.countTable('coach_profiles'),
      this.countTable('games'),
      this.countTable('venues'),
    ])

    return [
      { label: 'Users', value: users, detail: 'Accounts available for competition ownership' },
      { label: 'Leagues', value: leagues, detail: 'Public competitions created' },
      { label: 'Teams', value: teams, detail: 'Team shells across all leagues' },
      { label: 'Players', value: players, detail: 'Player profiles and roster members' },
      { label: 'Coaches', value: coaches, detail: 'Coach profiles created' },
      { label: 'Games', value: games, detail: 'Scheduled and completed matches' },
      { label: 'Venues', value: venues, detail: 'Saved match locations' },
    ]
  }

  private async countTable(tableName: string): Promise<number> {
    const row = await db.from(tableName).count('* as total').first()
    return getCount(row as Record<string, unknown> | null)
  }

  private async countryOptions(): Promise<CountryOption[]> {
    const countries = await Country.query().orderBy('name', 'asc')
    return countries.map((country) => ({
      id: country.id,
      name: country.name,
      code: country.code,
    }))
  }

  private async leagueOptions(): Promise<LeagueOption[]> {
    const leagues = await League.query()
      .preload('country')
      .preload('seasons', (seasonQuery) => {
        seasonQuery.orderBy('status', 'asc').orderBy('id', 'desc')
      })
      .orderBy('id', 'desc')
      .limit(80)

    const ids = leagues.map((league) => league.id)
    const teamRows =
      ids.length > 0
        ? await db
            .from('teams')
            .select('league_id')
            .count('* as total')
            .whereIn('league_id', ids)
            .groupBy('league_id')
        : []
    const teamCounts = new Map(
      (teamRows as Record<string, unknown>[]).map((row) => [
        Number(row.league_id),
        getCount(row),
      ])
    )

    return leagues.map((league) => {
      const activeSeason =
        league.seasons.find((season) => season.status === 'active') ?? league.seasons[0] ?? null
      return {
        id: league.id,
        name: league.name,
        country: league.country?.name ?? 'No country',
        teamCount: teamCounts.get(league.id) ?? 0,
        seasonLabel: activeSeason ? `${activeSeason.name} (${activeSeason.status})` : 'No season',
      }
    })
  }

  private async userOptions(): Promise<UserOption[]> {
    const users = await User.query().orderBy('id', 'desc').limit(120)
    const ids = users.map((user) => user.id)
    const leagueRows =
      ids.length > 0
        ? await db
            .from('leagues')
            .select('user_id')
            .count('* as total')
            .whereIn('user_id', ids)
            .groupBy('user_id')
        : []
    const leagueCounts = new Map(
      (leagueRows as Record<string, unknown>[]).map((row) => [Number(row.user_id), getCount(row)])
    )

    return users.map((user) => ({
      id: user.id,
      name: user.fullName ?? user.email,
      email: user.email,
      phone: user.phone,
      recoveryEmail: user.recoveryEmail,
      leagueCount: leagueCounts.get(user.id) ?? 0,
    }))
  }

  private async importTeamOptions(): Promise<ImportTeamOption[]> {
    const teams = await Team.query().preload('league').orderBy('league_id', 'desc').orderBy('name', 'asc').limit(300)
    return teams.map((team) => ({
      id: team.id,
      name: team.name ?? 'Unnamed team',
      leagueId: team.leagueId,
      leagueName: team.league?.name ?? `League ${team.leagueId}`,
    }))
  }

  private async userDetail(userId: number | null): Promise<UserDetail | null> {
    if (!userId) return null

    const user = await User.find(userId)
    if (!user) return null

    const [leagues, teamsAdded, notifications] = await Promise.all([
      this.leagueOptionsForUser(user.id),
      db.from('teams').where('added_by', user.id).count('* as total').first(),
      db.from('user_notifications').where('user_id', user.id).count('* as total').first(),
    ])

    return {
      user: {
        id: user.id,
        name: user.fullName ?? user.email,
        email: user.email,
        phone: user.phone,
        recoveryEmail: user.recoveryEmail,
        leagueCount: leagues.length,
        createdAt: user.createdAt?.toISO?.() ?? '',
        updatedAt: user.updatedAt?.toISO?.() ?? '',
      },
      leagues,
      counts: {
        leagues: leagues.length,
        teamsAdded: getCount(teamsAdded as Record<string, unknown> | null),
        notifications: getCount(notifications as Record<string, unknown> | null),
      },
    }
  }

  private async leagueOptionsForUser(userId: number): Promise<LeagueOption[]> {
    const leagues = await League.query()
      .where('userId', userId)
      .preload('country')
      .preload('seasons', (seasonQuery) => {
        seasonQuery.orderBy('status', 'asc').orderBy('id', 'desc')
      })
      .orderBy('id', 'desc')
      .limit(40)

    const ids = leagues.map((league) => league.id)
    const teamRows =
      ids.length > 0
        ? await db
            .from('teams')
            .select('league_id')
            .count('* as total')
            .whereIn('league_id', ids)
            .groupBy('league_id')
        : []
    const teamCounts = new Map(
      (teamRows as Record<string, unknown>[]).map((row) => [
        Number(row.league_id),
        getCount(row),
      ])
    )

    return leagues.map((league) => {
      const activeSeason =
        league.seasons.find((season) => season.status === 'active') ?? league.seasons[0] ?? null
      return {
        id: league.id,
        name: league.name,
        country: league.country?.name ?? 'No country',
        teamCount: teamCounts.get(league.id) ?? 0,
        seasonLabel: activeSeason ? `${activeSeason.name} (${activeSeason.status})` : 'No season',
      }
    })
  }

  private async competitionDetail(leagueId: number | null): Promise<CompetitionDetail | null> {
    if (!leagueId) return null

    const league = await League.query()
      .where('id', leagueId)
      .preload('user')
      .preload('seasons', (seasonQuery) => seasonQuery.orderBy('id', 'desc'))
      .first()
    if (!league) return null

    const [teams, venues, gameCount, playerCount] = await Promise.all([
      Team.query().where('leagueId', league.id).orderBy('name', 'asc'),
      Venue.query().where('leagueId', league.id).orderBy('name', 'asc'),
      db.from('games').where('league_id', league.id).count('* as total').first(),
      db.from('league_players').where('league_id', league.id).count('* as total').first(),
    ])
    const teamIds = teams.map((team) => team.id)
    const rosterRows =
      teamIds.length > 0
        ? await db
            .from('league_players')
            .select('team_id')
            .count('* as total')
            .whereIn('team_id', teamIds)
            .groupBy('team_id')
        : []
    const rosterCounts = new Map(
      (rosterRows as Record<string, unknown>[]).map((row) => [Number(row.team_id), getCount(row)])
    )

    return {
      league: {
        id: league.id,
        name: league.name,
        description: league.description,
        gender: league.gender,
        countryId: league.countryId,
        userId: league.userId,
        logoUrl: league.logoUrl,
        startDate: this.dateInputValue(league.startDate),
        endDate: this.dateInputValue(league.endDate),
        tiebreaker: league.tiebreaker,
      },
      owner: league.user
        ? {
            id: league.user.id,
            name: league.user.fullName ?? league.user.email,
            email: league.user.email,
            phone: league.user.phone,
            recoveryEmail: league.user.recoveryEmail,
            leagueCount: 0,
          }
        : null,
      seasons: league.seasons.map((season) => ({
        id: season.id,
        name: season.name,
        status: season.status,
      })),
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name ?? 'Unnamed team',
        logoUrl: team.logoUrl,
        playerCount: rosterCounts.get(team.id) ?? 0,
      })),
      venues: venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        city: venue.city,
        capacity: venue.capacity,
        notes: venue.notes,
      })),
      counts: {
        games: getCount(gameCount as Record<string, unknown> | null),
        players: getCount(playerCount as Record<string, unknown> | null),
        venues: venues.length,
        teams: teams.length,
      },
    }
  }

  private async createVenues(
    leagueId: number,
    userId: number,
    rows: Array<{ name: string; address: string | null; city: string | null; capacity: number | null }>
  ) {
    if (rows.length === 0) return []

    return Venue.createMany(
      rows.map((row) => ({
        leagueId,
        createdBy: userId,
        name: row.name,
        address: row.address,
        city: row.city,
        capacity: row.capacity,
        notes: null,
        latitude: null,
        longitude: null,
        googlePlaceId: null,
      }))
    )
  }

  private async resolveSeason(leagueId: number, seasonId: number | null): Promise<Season> {
    if (seasonId) {
      return Season.query().where('id', seasonId).where('league_id', leagueId).firstOrFail()
    }

    const active = await Season.query()
      .where('league_id', leagueId)
      .where('status', 'active')
      .orderBy('id', 'desc')
      .first()
    if (active) return active

    return Season.query().where('league_id', leagueId).orderBy('id', 'desc').firstOrFail()
  }

  private async teamMap(leagueId: number): Promise<Map<string, Team>> {
    const teams = await Team.query().where('league_id', leagueId)
    const map = new Map<string, Team>()
    for (const team of teams) {
      const name = team.name ?? ''
      map.set(this.lookupKey(name), team)
      const compact = this.lookupKey(name.replace(/\b(fc|fa|football club|football academy)\b/gi, ''))
      if (compact) map.set(compact, team)
    }
    return map
  }

  private requiredTeam(map: Map<string, Team>, value: unknown): Team {
    const label = this.requiredString(value, 'Team')
    const team = map.get(this.lookupKey(label))
    if (!team) {
      throw new Error(`Team not found: ${label}. Add the team first or check the spelling.`)
    }
    return team
  }

  private async findExistingPlayerMembership(input: {
    leagueId: number
    seasonId: number
    teamId: number
    name: string
    jerseyNumber?: string
  }): Promise<Player | null> {
    const membershipQuery = LeaguePlayer.query()
      .where('league_id', input.leagueId)
      .where('season_id', input.seasonId)
      .where('team_id', input.teamId)
      .preload('player')
    const jerseyNumber = this.readOptionalString(input.jerseyNumber)
    if (jerseyNumber) {
      membershipQuery.where('jersey_number', jerseyNumber)
    }
    const membership = await membershipQuery.first()
    if (membership?.player) return membership.player

    const existing = await Player.query().whereRaw('lower(name) = ?', [input.name.toLowerCase()]).first()
    return existing ?? null
  }

  private async createImportedPlayer(input: {
    name: string
    position: PlayerPosition | null
    league: League
  }): Promise<Player> {
    const email = this.importEmail('player', `${input.league.id}-${input.name}`)
    const user = await User.updateOrCreate({ email }, { email, fullName: input.name })
    const fallbackCountry = input.league.countryId
      ? input.league.countryId
      : ((await Country.query().where('code', 'ng').first())?.id ?? 1)
    return Player.updateOrCreate(
      { userId: user.id },
      {
        userId: user.id,
        addedBy: input.league.userId,
        name: input.name,
        countryId: fallbackCountry,
        nationality: null,
        avatarUrl: null,
        bio: null,
        dateOfBirth: null,
        heightCm: null,
        primaryPosition: input.position,
        secondaryPosition: null,
        preferredFoot: null,
        city: 'Lagos',
        state: 'Lagos',
        visibility: 'active',
      }
    )
  }

  private async findOrCreateVenue(league: League, nameValue: unknown): Promise<Venue | null> {
    const name = this.readOptionalString(nameValue)
    if (!name) return null

    const existing = await Venue.query()
      .where('league_id', league.id)
      .whereRaw('lower(name) = ?', [name.toLowerCase()])
      .first()
    if (existing) return existing

    return Venue.create({
      leagueId: league.id,
      createdBy: league.userId,
      name,
      address: null,
      city: null,
      capacity: null,
      notes: 'Imported from client website fixture data.',
      latitude: null,
      longitude: null,
      googlePlaceId: null,
    })
  }

  private readOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }

  private requiredString(value: unknown, label: string): string {
    const trimmed = this.readOptionalString(value)
    if (!trimmed) {
      throw new Error(`${label} is required.`)
    }
    return trimmed
  }

  private safePositiveInt(value: unknown, label: string): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new Error(`${label} must be a positive number.`)
    }
    return Math.floor(parsed)
  }

  private optionalPositiveInt(value: unknown): number | null {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
  }

  private optionalNumber(value: unknown): number | null {
    const raw = this.readOptionalString(value)
    if (!raw) return null

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  private safeFormat(value: unknown): CompetitionFormat {
    const format = String(value ?? 'league')
    return ['league', 'knockout', 'group'].includes(format)
      ? (format as CompetitionFormat)
      : 'league'
  }

  private optionalDate(value: unknown): DateTime | null {
    const raw = this.readOptionalString(value)
    if (!raw) return null

    const date = DateTime.fromISO(raw)
    return date.isValid ? date : null
  }

  private dateInputValue(value: DateTime | null | undefined): string {
    if (!value) return ''
    return value.toISODate() ?? ''
  }

  private requiredDateTime(value: unknown): DateTime {
    const raw = this.requiredString(value, 'Played at')
    const formats = ['yyyy-MM-dd HH:mm', 'yyyy-MM-dd HH:mm:ss', 'dd LLL yyyy HH:mm', 'dd/MM/yyyy HH:mm']
    const iso = DateTime.fromISO(raw)
    if (iso.isValid) return iso

    for (const format of formats) {
      const parsed = DateTime.fromFormat(raw, format)
      if (parsed.isValid) return parsed
    }

    throw new Error(`Invalid match date: ${raw}. Use YYYY-MM-DD HH:mm.`)
  }

  private parsePipeRows(value: unknown, keys: string[]): Array<Record<string, string>> {
    if (typeof value !== 'string') return []

    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const cells = line.split('|').map((cell) => cell.trim())
        const row: Record<string, string> = {}
        keys.forEach((key, index) => {
          row[key] = cells[index] ?? ''
        })
        return row
      })
  }

  private lookupKey(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  private importEmail(kind: string, value: string): string {
    const slug = string.slug(`${kind}-${value}`) || `${kind}-${string.uuid()}`
    return `${slug.slice(0, 180)}@sportykore.import`
  }

  private normalizePosition(value: unknown): PlayerPosition | null {
    const raw = this.readOptionalString(value)?.toUpperCase()
    if (!raw) return null
    if (raw.startsWith('GK')) return 'goalkeeper'
    if (raw.startsWith('DEF')) return 'defence'
    if (raw.startsWith('MID')) return 'midfield'
    if (raw.startsWith('FWD') || raw.startsWith('ATT') || raw.startsWith('STR')) return 'attack'
    return null
  }

  private logoFile(request: HttpContext['request'], field: string): MultipartFile | null {
    const file = request.file(field)
    if (!file) return null

    const extname = (file.extname ?? '').toLowerCase()
    if (!LOGO_EXTENSIONS.has(extname)) {
      throw new Error('Logo must be a JPEG, PNG, or WebP image.')
    }

    if (typeof file.size === 'number' && file.size > MAX_LOGO_BYTES) {
      throw new Error('Logo must be 10MB or smaller.')
    }

    if (file.isValid === false) {
      throw new Error(file.errors?.[0]?.message ?? 'Logo upload failed validation.')
    }

    return file
  }

  private teamLogoInputs(request: HttpContext['request'], prefix: string): TeamLogoInput[] {
    const teams: TeamLogoInput[] = this.parseNameLines(request.input('teams')).map((name) => ({
      name,
      logo: null,
    }))
    const byName = new Map(teams.map((team, index) => [team.name.toLowerCase(), index]))

    for (let index = 0; index < 12; index += 1) {
      const name = this.readOptionalString(request.input(`${prefix}Name${index}`))
      const logo = this.logoFile(request, `${prefix}Logo${index}`)

      if (!name && logo) {
        throw new Error('Every uploaded team logo needs a team name in the same row.')
      }
      if (!name) continue

      const key = name.toLowerCase()
      const existingIndex = byName.get(key)
      if (existingIndex !== undefined) {
        teams[existingIndex].logo = logo
        continue
      }

      byName.set(key, teams.length)
      teams.push({ name, logo })
    }

    return teams
  }

  private parseNameLines(value: unknown): string[] {
    if (typeof value !== 'string') return []
    const seen = new Set<string>()
    const names: string[] = []

    for (const line of value.split(/\r?\n/)) {
      const name = line
        .trim()
        .replace(/^[\d.)\-\s]+/, '')
        .trim()
      const key = name.toLowerCase()
      if (!name || seen.has(key)) continue
      seen.add(key)
      names.push(name)
    }

    return names
  }

  private parseVenueLines(
    value: unknown
  ): Array<{ name: string; address: string | null; city: string | null; capacity: number | null }> {
    if (typeof value !== 'string') return []

    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, address, city, capacity] = line.split('|').map((part) => part.trim())
        if (!name) {
          throw new Error('Every venue row needs a name.')
        }

        const parsedCapacity = capacity ? Number(capacity) : null
        return {
          name,
          address: address || null,
          city: city || null,
          capacity: Number.isFinite(parsedCapacity) ? parsedCapacity : null,
        }
      })
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Something went wrong.'
  }

  private renderLogin(error?: string): string {
    return this.page('Secret Santa', {
      body: `
        <main class="login-shell">
          <section class="login-card">
            <p class="eyebrow">SportyKore Admin</p>
            <h1>Secret Santa</h1>
            <p class="muted">Enter the dashboard password from the server environment.</p>
            ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
            <form method="post" action="/secret-santa" class="login-form">
              <label>
                <span>Password</span>
                <input name="password" type="password" autocomplete="current-password" autofocus />
              </label>
              <button type="submit">Unlock dashboard</button>
            </form>
          </section>
        </main>
      `,
    })
  }

  private renderDashboard(data: AdminDashboardData): string {
    const content =
      data.tab === 'users'
        ? this.renderUsersTab(data.users, data.selectedUser)
        : data.tab === 'competitions'
          ? this.renderCompetitionsTab(
              data.leagues,
              data.selectedCompetition,
              data.users,
              data.countries
            )
          : data.tab === 'imports'
            ? this.renderImportsTab(data.leagues, data.importTeams)
        : data.tab === 'onboard'
          ? this.renderOnboardTab(data.countries, data.leagues, data.users)
          : data.tab === 'teams'
        ? this.renderTeamsTab(data.leagues)
        : data.tab === 'venues'
          ? this.renderVenuesTab(data.leagues)
          : this.renderOverviewTab(data.stats, data.leagues, data.users)

    return this.page('Secret Santa Dashboard', {
      body: `
        <main class="dashboard">
          <aside class="sidebar">
            <div>
              <p class="eyebrow">SportyKore Admin</p>
              <h1>Operations</h1>
              <p class="muted">Create users, competitions, teams, and venues before handing the league to organisers.</p>
            </div>
            <nav class="main-tabs">
              ${this.tabLink('overview', 'Overview', data.tab)}
              ${this.tabLink('users', 'Users', data.tab)}
              ${this.tabLink('competitions', 'Competitions', data.tab)}
              ${this.tabLink('imports', 'Import data', data.tab)}
              ${this.tabLink('onboard', 'Create competition', data.tab)}
              ${this.tabLink('teams', 'Add teams', data.tab)}
              ${this.tabLink('venues', 'Add venues', data.tab)}
            </nav>
            ${this.renderSetupChecklist()}
            <form method="post" action="/secret-santa/logout">
              <button class="secondary" type="submit">Lock dashboard</button>
            </form>
          </aside>
          <section class="content">
            ${
              data.notice
                ? `<div class="notice success">${escapeHtml(data.notice)}</div>`
                : ''
            }
            ${data.error ? `<div class="notice error">${escapeHtml(data.error)}</div>` : ''}
            ${content}
          </section>
        </main>
      `,
    })
  }

  private tabLink(tab: DashboardTab, label: string, active: DashboardTab): string {
    return `<a class="${tab === active ? 'active' : ''}" href="/secret-santa?tab=${tab}">
      <span>${escapeHtml(label)}</span>
    </a>`
  }

  private renderOverviewTab(
    stats: DashboardStat[],
    leagues: LeagueOption[],
    users: UserOption[]
  ): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">Admin overview</p>
          <h2>Onboarding desk</h2>
          <p class="muted">A quick read on what exists in SportyKore before you add the next competition.</p>
        </div>
        <a class="header-action" href="/secret-santa?tab=users">Create user</a>
      </header>

      <section class="overview-grid">
        ${stats
          .map(
            (stat) => `
              <article class="stat-card">
                <span>${escapeHtml(stat.label)}</span>
                <strong>${stat.value.toLocaleString()}</strong>
                <p>${escapeHtml(stat.detail)}</p>
              </article>
            `
          )
          .join('')}
      </section>

      <section class="overview-columns">
        <article class="ops-card">
          <div class="section-head">
            <h3>Recent competitions</h3>
            <a href="/secret-santa?tab=onboard">Create competition</a>
          </div>
          <div class="league-stack">${this.renderLeagueCards(leagues.slice(0, 8))}</div>
        </article>
        <article class="ops-card">
          <div class="section-head">
            <h3>Recent users</h3>
            <a href="/secret-santa?tab=users">Add user</a>
          </div>
          <div class="league-stack">${this.renderUserCards(users.slice(0, 8))}</div>
        </article>
      </section>
    `
  }

  private renderUsersTab(users: UserOption[], selected: UserDetail | null): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">User management</p>
          <h2>Users</h2>
          <p class="muted">Create organiser accounts, edit contact details, and see the competitions attached to each user.</p>
        </div>
      </header>

      <section class="manage-grid">
        <aside class="ops-card entity-list">
          <div class="section-head">
            <h3>Select user</h3>
            <span>${users.length} shown</span>
          </div>
          <div class="league-stack">${this.renderUserLinks(users, selected?.user.id ?? null)}</div>
        </aside>

        <div class="entity-main">
          <form method="post" action="/secret-santa/onboard/users" class="ops-card form-grid">
            <div class="section-head">
              <h3>Create user</h3>
              <span>For competition ownership</span>
            </div>
            <div class="two-col">
              ${this.inputField('Full name', 'fullName', 'text', 'Competition organiser', true)}
              ${this.inputField('Email', 'email', 'email', 'owner@example.com', true)}
            </div>
            <div class="two-col">
              ${this.inputField('Phone', 'phone', 'tel', '+234...')}
              ${this.inputField('Recovery email', 'recoveryEmail', 'email', 'backup@example.com')}
            </div>
            <button type="submit" class="primary-action">Save user</button>
          </form>

          ${selected ? this.renderUserDetail(selected) : this.emptyPanel('No user selected', 'Create or select a user to edit their details.')}
        </div>
      </section>
    `
  }

  private renderUserDetail(detail: UserDetail): string {
    return `
      <section class="ops-card form-grid">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(detail.user.name)}</h3>
            <p class="hint">${escapeHtml(detail.user.email)}</p>
          </div>
          <span class="status-chip">${detail.counts.leagues} competition${detail.counts.leagues === 1 ? '' : 's'}</span>
        </div>
        <div class="mini-grid">
          <div><strong>${detail.counts.leagues}</strong><span>Owned competitions</span></div>
          <div><strong>${detail.counts.teamsAdded}</strong><span>Teams added</span></div>
          <div><strong>${detail.counts.notifications}</strong><span>Notifications</span></div>
        </div>
        <form method="post" action="/secret-santa/users/${detail.user.id}" class="form-grid">
          <div class="two-col">
            ${this.valueInputField('Full name', 'fullName', 'text', detail.user.name, true)}
            ${this.valueInputField('Email', 'email', 'email', detail.user.email, true)}
          </div>
          <div class="two-col">
            ${this.valueInputField('Phone', 'phone', 'tel', detail.user.phone ?? '')}
            ${this.valueInputField('Recovery email', 'recoveryEmail', 'email', detail.user.recoveryEmail ?? '')}
          </div>
          <button type="submit" class="primary-action">Update user</button>
        </form>
        <div class="form-section full">
          <h3>Competitions owned</h3>
          <div class="league-stack">${this.renderLeagueLinks(detail.leagues, null)}</div>
        </div>
      </section>
    `
  }

  private renderCompetitionsTab(
    leagues: LeagueOption[],
    selected: CompetitionDetail | null,
    users: UserOption[],
    countries: CountryOption[]
  ): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">Competition management</p>
          <h2>Competitions</h2>
          <p class="muted">Edit competition setup, ownership, season labels, teams, and venues. Match center actions stay in the app.</p>
        </div>
        <a class="header-action" href="/secret-santa?tab=onboard">Create competition</a>
      </header>

      <section class="manage-grid">
        <aside class="ops-card entity-list">
          <div class="section-head">
            <h3>Select competition</h3>
            <span>${leagues.length} shown</span>
          </div>
          <div class="league-stack">${this.renderLeagueLinks(leagues, selected?.league.id ?? null)}</div>
        </aside>

        <div class="entity-main">
          ${
            selected
              ? this.renderCompetitionDetail(selected, users, countries)
              : this.emptyPanel('No competition selected', 'Create or select a competition to view and edit its setup.')
          }
        </div>
      </section>
    `
  }

  private renderCompetitionDetail(
    detail: CompetitionDetail,
    users: UserOption[],
    countries: CountryOption[]
  ): string {
    return `
      <section class="ops-card form-grid">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(detail.league.name)}</h3>
            <p class="hint">${detail.owner ? `Owned by ${escapeHtml(detail.owner.name)}` : 'No owner found'}</p>
          </div>
          <span class="status-chip">${detail.counts.teams} teams</span>
        </div>
        <div class="mini-grid">
          <div><strong>${detail.counts.teams}</strong><span>Teams</span></div>
          <div><strong>${detail.counts.players}</strong><span>Players</span></div>
          <div><strong>${detail.counts.games}</strong><span>Games</span></div>
          <div><strong>${detail.counts.venues}</strong><span>Venues</span></div>
        </div>

        <form method="post" action="/secret-santa/competitions/${detail.league.id}" class="form-grid" enctype="multipart/form-data">
          <div class="form-section full">
            <h3>Competition details</h3>
            <div class="two-col">
              ${this.valueInputField('Competition name', 'name', 'text', detail.league.name, true)}
              ${this.valueInputField('Logo URL', 'logoUrl', 'url', detail.league.logoUrl ?? '')}
            </div>
            <label>
              <span>Upload logo</span>
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            ${detail.league.logoUrl ? `<p class="hint">Current logo: <a href="${escapeHtml(detail.league.logoUrl)}" target="_blank" rel="noreferrer">open image</a></p>` : ''}
            <label class="full">
              <span>Description</span>
              <textarea name="description" rows="3">${escapeHtml(detail.league.description ?? '')}</textarea>
            </label>
            <div class="three-col">
              <label>
                <span>Owner</span>
                ${this.userSelect(users, detail.league.userId)}
              </label>
              <label>
                <span>Country</span>
                ${this.countrySelect(countries, detail.league.countryId)}
              </label>
              <label>
                <span>Gender</span>
                ${this.genderSelect(detail.league.gender)}
              </label>
            </div>
            <div class="three-col">
              ${this.valueInputField('Start date', 'startDate', 'date', detail.league.startDate)}
              ${this.valueInputField('End date', 'endDate', 'date', detail.league.endDate)}
              ${this.valueInputField('Tiebreaker', 'tiebreaker', 'text', detail.league.tiebreaker)}
            </div>
          </div>
          <button type="submit" class="primary-action">Update competition</button>
        </form>
      </section>

      <section class="ops-card form-grid">
        <div class="section-head">
          <h3>Seasons</h3>
          <span>${detail.seasons.length} total</span>
        </div>
        <div class="edit-list">
          ${
            detail.seasons.length > 0
              ? detail.seasons.map((season) => this.renderSeasonRow(season)).join('')
              : '<p class="hint">No seasons found for this competition.</p>'
          }
        </div>
      </section>

      <section class="ops-card form-grid">
        <div class="section-head">
          <h3>Teams</h3>
          <span>${detail.teams.length} total</span>
        </div>
        <div class="edit-list">
          ${
            detail.teams.length > 0
              ? detail.teams.map((team) => this.renderTeamRow(team)).join('')
              : '<p class="hint">No teams yet. Use the Add teams tab to bulk create them.</p>'
          }
        </div>
      </section>

      <section class="ops-card form-grid">
        <div class="section-head">
          <h3>Venues</h3>
          <span>${detail.venues.length} total</span>
        </div>
        <div class="edit-list">
          ${
            detail.venues.length > 0
              ? detail.venues.map((venue) => this.renderVenueRow(venue)).join('')
              : '<p class="hint">No venues yet. Use the Add venues tab to create match locations.</p>'
          }
        </div>
      </section>
    `
  }

  private renderSeasonRow(season: { id: number; name: string; status: string }): string {
    return `
      <form method="post" action="/secret-santa/seasons/${season.id}" class="edit-row">
        ${this.valueInputField('Season name', 'name', 'text', season.name, true)}
        <label>
          <span>Status</span>
          <select name="status" required>
            ${['draft', 'active', 'completed', 'archived']
              .map(
                (status) =>
                  `<option value="${status}" ${season.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`
              )
              .join('')}
          </select>
        </label>
        <button type="submit">Save</button>
      </form>
    `
  }

  private renderTeamRow(team: { id: number; name: string; logoUrl: string | null; playerCount: number }): string {
    return `
      <form method="post" action="/secret-santa/teams/${team.id}" class="edit-row team-edit-row" enctype="multipart/form-data">
        ${this.valueInputField('Team name', 'name', 'text', team.name, true)}
        ${this.valueInputField('Logo URL', 'logoUrl', 'url', team.logoUrl ?? '')}
        <label>
          <span>Upload logo</span>
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <div class="row-metric"><strong>${team.playerCount}</strong><span>players</span></div>
        <button type="submit">Save</button>
      </form>
    `
  }

  private renderVenueRow(venue: CompetitionDetail['venues'][number]): string {
    return `
      <form method="post" action="/secret-santa/venues/${venue.id}" class="edit-row venue-row">
        ${this.valueInputField('Venue name', 'name', 'text', venue.name, true)}
        ${this.valueInputField('Address', 'address', 'text', venue.address ?? '')}
        ${this.valueInputField('City', 'city', 'text', venue.city ?? '')}
        ${this.valueInputField('Capacity', 'capacity', 'number', venue.capacity?.toString() ?? '')}
        <label class="full">
          <span>Notes</span>
          <textarea name="notes" rows="2">${escapeHtml(venue.notes ?? '')}</textarea>
        </label>
        <button type="submit">Save</button>
      </form>
    `
  }

  private renderImportsTab(leagues: LeagueOption[], teams: ImportTeamOption[]): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">Client website import</p>
          <h2>Import TCC data</h2>
          <p class="muted">Use this for sites like The Creative Championship: clubs first, then players, staff, fixtures and results.</p>
        </div>
        <a class="header-action" href="https://thecreativechampionship.com" target="_blank" rel="noreferrer">Open source site</a>
      </header>

      <section class="overview-columns">
        <article class="ops-card form-grid">
          <div class="section-head">
            <h3>Import players</h3>
            <span>Team | Jersey | Name | Position</span>
          </div>
          <p class="hint">The TCC players page exposes club, jersey number, name and position. Players without emails get internal placeholder accounts.</p>
          <form method="post" action="/secret-santa/imports/players" class="form-grid">
            <label>
              <span>League</span>
              ${this.leagueSelect(leagues)}
            </label>
            <label class="full">
              <span>Players</span>
              <textarea name="players" rows="10" placeholder="Beyond Limits FA | 18 | Abiodun Oladosu | FWD&#10;Iganmu FC | 40 | Adeleke Olajide | FWD"></textarea>
            </label>
            <button type="submit" class="primary-action">Import players</button>
          </form>
        </article>

        <article class="ops-card form-grid">
          <div class="section-head">
            <h3>Import staff</h3>
            <span>Team | Name | Role | Department</span>
          </div>
          <p class="hint">Creates coach profiles and assigns each person as a team admin so their league history appears.</p>
          <form method="post" action="/secret-santa/imports/staff" class="form-grid">
            <label>
              <span>League</span>
              ${this.leagueSelect(leagues)}
            </label>
            <label class="full">
              <span>Staff</span>
              <textarea name="staff" rows="10" placeholder="Sporting Lagos FA | Daniel Brugni | Head Coach | Technical&#10;Imperial FC | Adebayo Joshua | Head of Operations | Operations"></textarea>
            </label>
            <button type="submit" class="primary-action">Import staff</button>
          </form>
        </article>
      </section>

      <section class="split-grid import-grid">
        <article class="ops-card form-grid">
          <div class="section-head">
            <h3>Import fixtures and results</h3>
            <span>Date | Home | Away | Venue | Status | HS | AS | Round</span>
          </div>
          <p class="hint">Use status scheduled for upcoming games and full_time for finished results. Dates should be YYYY-MM-DD HH:mm.</p>
          <form method="post" action="/secret-santa/imports/games" class="form-grid">
            <label>
              <span>League</span>
              ${this.leagueSelect(leagues)}
            </label>
            <label class="full">
              <span>Fixtures/results</span>
              <textarea name="games" rows="12" placeholder="2026-09-25 11:00 | Valiant FC | Sporting Lagos FA | Legacy Pitch, Surulere | scheduled | | | Matchday 3&#10;2026-09-14 16:00 | Real Sapphire | Sporting Lagos FA | Dipo Dina International Stadium | full_time | 0 | 0 | Matchday 2"></textarea>
            </label>
            <button type="submit" class="primary-action">Import fixtures</button>
          </form>
        </article>

        <aside class="ops-card">
          <h3>What I found on TCC</h3>
          <div class="import-notes">
            <p><strong>Competition profile:</strong> Established 2020, Lagos, grassroots football, #WeAreOneTeam.</p>
            <p><strong>Clubs:</strong> 14 current clubs are listed across league and cup contexts.</p>
            <p><strong>Players:</strong> 449 registered players with jersey numbers and positions.</p>
            <p><strong>Staff:</strong> 104 coaches/backroom staff across clubs and departments.</p>
            <p><strong>Matches:</strong> fixtures/results include date, venue, clubs, scores and matchday labels.</p>
          </div>
          <h3>Teams currently available</h3>
          <div class="compact-list">
            ${teams
              .slice(0, 24)
              .map(
                (team) =>
                  `<span>${escapeHtml(team.name)} <small>${escapeHtml(team.leagueName)}</small></span>`
              )
              .join('')}
          </div>
        </aside>
      </section>
    `
  }

  private renderOnboardTab(
    countries: CountryOption[],
    leagues: LeagueOption[],
    users: UserOption[]
  ): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">Competition setup</p>
          <h2>Create a competition</h2>
          <p class="muted">Assign the competition to an existing user, then create the active season, teams, and optional venues in one pass.</p>
        </div>
        <a class="header-action" href="/secret-santa?tab=users">Add owner</a>
      </header>

      <section class="split-grid">
        <form method="post" action="/secret-santa/onboard/competition" class="ops-card form-grid" enctype="multipart/form-data">
          <div class="form-section full">
            <h3>Owner</h3>
            <label class="full">
              <span>Competition owner</span>
              ${this.userSelect(users)}
            </label>
            <p class="hint">Create the user first if the organiser is not listed yet.</p>
          </div>

          <div class="form-section full">
            <h3>Competition</h3>
            <div class="two-col">
              ${this.inputField('Competition name', 'name', 'text', 'FUOYE Champions League 2.0', true)}
              ${this.inputField('Season name', 'seasonName', 'text', '2026 Season', true)}
            </div>
            <label>
              <span>Competition logo</span>
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            <label class="full">
              <span>Description</span>
              <textarea name="description" rows="3" placeholder="Short public description for the league page"></textarea>
            </label>
            <div class="three-col">
              <label>
                <span>Country</span>
                <select name="countryId" required>
                  ${countries
                    .map(
                      (country) =>
                        `<option value="${country.id}">${escapeHtml(country.name)} (${escapeHtml(country.code.toUpperCase())})</option>`
                    )
                    .join('')}
                </select>
              </label>
              <label>
                <span>Gender</span>
                <select name="gender">
                  <option value="mixed">Mixed</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label>
                <span>Format</span>
                <select name="format">
                  <option value="group">Group</option>
                  <option value="league">League table</option>
                  <option value="knockout">Knockout</option>
                </select>
              </label>
            </div>
            <div class="two-col">
              ${this.inputField('Start date', 'startDate', 'date')}
              ${this.inputField('End date', 'endDate', 'date')}
            </div>
          </div>

          <div class="form-section full">
            <h3>Group defaults</h3>
            <p class="hint">Used only when format is Group. You can still adjust groups and fixtures in the app.</p>
            <div class="three-col">
              ${this.inputField('Group stage name', 'groupName', 'text', 'Opening Stage')}
              ${this.inputField('Group count', 'groupCount', 'number', '2', true)}
              ${this.inputField('Advancement per group', 'advancementPerGroup', 'number', '2', true)}
            </div>
            <label class="checkbox-row">
              <input type="checkbox" name="doubleRoundRobin" />
              <span>Double round robin group fixtures</span>
            </label>
          </div>

          <div class="form-section full">
            <h3>Teams</h3>
            <p class="hint">One team per line for fast entry, or use the logo rows below for teams with badge files.</p>
            <textarea name="teams" rows="10" placeholder="Faculty Warriors&#10;Ikole City FC&#10;Oye Campus United"></textarea>
            ${this.renderTeamLogoRows('team')}
          </div>

          <div class="form-section full">
            <h3>Venues</h3>
            <p class="hint">Optional. One per line as: Name | Address | City | Capacity</p>
            <textarea name="venues" rows="5" placeholder="Main Bowl | FUOYE Oye Campus | Oye-Ekiti | 2000"></textarea>
          </div>

          <button type="submit" class="primary-action">Create competition</button>
        </form>

        <aside class="ops-card recent-card">
          <h3>Recent leagues</h3>
          <div class="league-stack">
            ${this.renderLeagueCards(leagues.slice(0, 8))}
          </div>
        </aside>
      </section>
    `
  }

  private renderTeamsTab(leagues: LeagueOption[]): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">Roster setup</p>
          <h2>Add teams</h2>
          <p class="muted">Bulk add team shells to an existing competition. Logos and detailed roster work can still happen in the app.</p>
        </div>
      </header>
      <section class="split-grid">
        <form method="post" action="/secret-santa/onboard/teams" class="ops-card form-grid" enctype="multipart/form-data">
          <label class="full">
            <span>League</span>
            ${this.leagueSelect(leagues)}
          </label>
          <label class="full">
            <span>Team names</span>
            <textarea name="teams" rows="10" placeholder="One team per line"></textarea>
          </label>
          <div class="form-section full">
            <h3>Teams with logos</h3>
            <p class="hint">Optional. Use these rows when you have logo files ready. Duplicate names from the textarea will receive the uploaded logo.</p>
            ${this.renderTeamLogoRows('team')}
          </div>
          <button type="submit" class="primary-action">Add teams</button>
        </form>
        <aside class="ops-card">
          <h3>Current leagues</h3>
          <div class="league-stack">${this.renderLeagueCards(leagues.slice(0, 12))}</div>
        </aside>
      </section>
    `
  }

  private renderVenuesTab(leagues: LeagueOption[]): string {
    return `
      <header class="content-header">
        <div>
          <p class="eyebrow">Match setup</p>
          <h2>Add venues</h2>
          <p class="muted">Create venue rows so games can be scheduled against real locations.</p>
        </div>
      </header>
      <section class="split-grid">
        <form method="post" action="/secret-santa/onboard/venues" class="ops-card form-grid">
          <label class="full">
            <span>League</span>
            ${this.leagueSelect(leagues)}
          </label>
          <label class="full">
            <span>Venues</span>
            <textarea name="venues" rows="12" required placeholder="Name | Address | City | Capacity"></textarea>
          </label>
          <button type="submit" class="primary-action">Add venues</button>
        </form>
        <aside class="ops-card">
          <h3>Format guide</h3>
          <p class="hint">Capacity is optional. If the address or city is unknown, leave that section blank but keep the pipe separators.</p>
          <code>Main Bowl | FUOYE Oye Campus | Oye-Ekiti | 2000</code>
        </aside>
      </section>
    `
  }

  private renderSetupChecklist(): string {
    return `
      <section class="checklist">
        <p class="sidebar-label">Onboarding checklist</p>
        <ol>
          <li>Create or reuse the organiser account.</li>
          <li>Create league and active season.</li>
          <li>Add teams and venues.</li>
          <li>Open the app to assign groups, fixtures, admins, and players.</li>
        </ol>
      </section>
    `
  }

  private renderLeagueCards(leagues: LeagueOption[]): string {
    if (leagues.length === 0) {
      return `<p class="hint">No leagues yet.</p>`
    }

    return leagues
      .map(
        (league) => `
          <article class="league-card">
            <strong>${escapeHtml(league.name)}</strong>
            <span>${escapeHtml(league.country)} · ${league.teamCount} team${league.teamCount === 1 ? '' : 's'}</span>
            <small>${escapeHtml(league.seasonLabel)}</small>
          </article>
        `
      )
      .join('')
  }

  private renderUserCards(users: UserOption[]): string {
    if (users.length === 0) {
      return `<p class="hint">No users yet. Create the organiser first.</p>`
    }

    return users
      .map(
        (user) => `
          <article class="league-card user-card">
            <strong>${escapeHtml(user.name)}</strong>
            <span>${escapeHtml(user.email)}</span>
            <small>${user.leagueCount} competition${user.leagueCount === 1 ? '' : 's'}${user.phone ? ` · ${escapeHtml(user.phone)}` : ''}</small>
          </article>
        `
      )
      .join('')
  }

  private renderLeagueLinks(leagues: LeagueOption[], selectedId: number | null): string {
    if (leagues.length === 0) {
      return `<p class="hint">No competitions yet.</p>`
    }

    return leagues
      .map(
        (league) => `
          <a class="league-card entity-link ${league.id === selectedId ? 'active' : ''}" href="/secret-santa?tab=competitions&leagueId=${league.id}">
            <strong>${escapeHtml(league.name)}</strong>
            <span>${escapeHtml(league.country)} · ${league.teamCount} team${league.teamCount === 1 ? '' : 's'}</span>
            <small>${escapeHtml(league.seasonLabel)}</small>
          </a>
        `
      )
      .join('')
  }

  private renderUserLinks(users: UserOption[], selectedId: number | null): string {
    if (users.length === 0) {
      return `<p class="hint">No users yet. Create the organiser first.</p>`
    }

    return users
      .map(
        (user) => `
          <a class="league-card entity-link user-card ${user.id === selectedId ? 'active' : ''}" href="/secret-santa?tab=users&userId=${user.id}">
            <strong>${escapeHtml(user.name)}</strong>
            <span>${escapeHtml(user.email)}</span>
            <small>${user.leagueCount} competition${user.leagueCount === 1 ? '' : 's'}${user.phone ? ` · ${escapeHtml(user.phone)}` : ''}</small>
          </a>
        `
      )
      .join('')
  }

  private emptyPanel(title: string, detail: string): string {
    return `
      <section class="ops-card empty-panel">
        <h3>${escapeHtml(title)}</h3>
        <p class="hint">${escapeHtml(detail)}</p>
      </section>
    `
  }

  private inputField(
    label: string,
    name: string,
    type: string,
    placeholder = '',
    required = false
  ): string {
    return `<label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} />
    </label>`
  }

  private renderTeamLogoRows(prefix: string): string {
    return `
      <div class="logo-row-grid">
        ${Array.from({ length: 12 }, (_, index) => `
          <div class="logo-row">
            ${this.inputField(`Team ${index + 1}`, `${prefix}Name${index}`, 'text', 'Team name')}
            <label>
              <span>Logo</span>
              <input name="${prefix}Logo${index}" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
          </div>
        `).join('')}
      </div>
    `
  }

  private valueInputField(
    label: string,
    name: string,
    type: string,
    value: string,
    required = false
  ): string {
    return `<label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${required ? 'required' : ''} />
    </label>`
  }

  private userSelect(users: UserOption[], selectedId: number | null = null): string {
    if (users.length === 0) {
      return `<select name="ownerId" required disabled>
        <option value="">Create a user first</option>
      </select>`
    }

    return `<select name="ownerId" required>
      ${users
        .map(
          (user) =>
            `<option value="${user.id}" ${user.id === selectedId ? 'selected' : ''}>${escapeHtml(user.name)} · ${escapeHtml(user.email)}</option>`
        )
        .join('')}
    </select>`
  }

  private countrySelect(countries: CountryOption[], selectedId: number | null): string {
    return `<select name="countryId" required>
      ${countries
        .map(
          (country) =>
            `<option value="${country.id}" ${country.id === selectedId ? 'selected' : ''}>${escapeHtml(country.name)} (${escapeHtml(country.code.toUpperCase())})</option>`
        )
        .join('')}
    </select>`
  }

  private genderSelect(selected: string | null): string {
    const options = ['mixed', 'male', 'female']
    return `<select name="gender">
      ${options
        .map(
          (option) =>
            `<option value="${option}" ${selected === option ? 'selected' : ''}>${escapeHtml(option)}</option>`
        )
        .join('')}
    </select>`
  }

  private leagueSelect(leagues: LeagueOption[]): string {
    return `<select name="leagueId" required>
      ${leagues
        .map(
          (league) =>
            `<option value="${league.id}">${escapeHtml(league.name)} (${league.teamCount} teams)</option>`
        )
        .join('')}
    </select>`
  }

  private page(title: string, { body }: { body: string }): string {
    return `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            :root {
              color-scheme: dark;
              --bg: #14061f;
              --panel: #1f0d31;
              --panel-2: #2a123f;
              --text: #fff8e7;
              --muted: #c8bad6;
              --accent: #d89500;
              --accent-2: #ffd76a;
              --danger: #ff7777;
              --line: rgba(255, 248, 231, 0.14);
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              background:
                linear-gradient(135deg, rgba(255,255,255,0.045) 25%, transparent 25%) 0 0 / 18px 18px,
                linear-gradient(135deg, transparent 75%, rgba(255,255,255,0.045) 75%) 0 0 / 18px 18px,
                var(--bg);
              color: var(--text);
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            a { color: inherit; text-decoration: none; }
            h1, h2, p { margin: 0; }
            button, input, select, textarea { font: inherit; }
            .login-shell {
              min-height: 100vh;
              display: grid;
              place-items: center;
              padding: 24px;
            }
            .login-card {
              width: min(100%, 420px);
              border: 1px solid var(--line);
              border-left: 8px solid var(--accent);
              border-radius: 18px;
              background: rgba(31, 13, 49, 0.96);
              padding: 28px;
              box-shadow: 0 28px 80px rgba(0,0,0,0.35);
            }
            .eyebrow {
              color: var(--accent-2);
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .login-card h1, .sidebar h1 {
              margin-top: 8px;
              font-size: clamp(32px, 8vw, 48px);
              line-height: 1;
            }
            .muted { margin-top: 8px; color: var(--muted); }
            .error {
              margin-top: 18px;
              border-radius: 12px;
              background: rgba(255, 119, 119, 0.13);
              color: var(--danger);
              padding: 12px 14px;
              font-weight: 700;
            }
            .login-form { margin-top: 24px; display: grid; gap: 16px; }
            label { display: grid; gap: 8px; color: var(--muted); font-size: 13px; font-weight: 800; }
            input, select, textarea {
              width: 100%;
              border: 1px solid var(--line);
              border-radius: 14px;
              background: #11051b;
              color: var(--text);
              padding: 14px 16px;
              outline: none;
            }
            textarea { min-height: 104px; resize: vertical; line-height: 1.45; }
            select { appearance: none; }
            input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(216, 149, 0, 0.18); }
            button, .pager a {
              border: 0;
              border-radius: 14px;
              background: var(--accent);
              color: #120719;
              cursor: pointer;
              font-weight: 900;
              padding: 13px 16px;
            }
            .dashboard {
              min-height: 100vh;
              display: grid;
              grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
            }
            .sidebar {
              position: sticky;
              top: 0;
              height: 100vh;
              overflow: auto;
              display: flex;
              flex-direction: column;
              gap: 22px;
              border-right: 1px solid var(--line);
              background: rgba(20, 6, 31, 0.95);
              padding: 24px;
            }
            nav { display: grid; gap: 8px; }
            nav a {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 14px;
              border: 1px solid transparent;
              border-radius: 12px;
              color: var(--muted);
              padding: 11px 12px;
            }
            nav a.active {
              border-color: rgba(216, 149, 0, 0.45);
              background: rgba(216, 149, 0, 0.12);
              color: var(--text);
            }
            nav span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            nav strong {
              border-radius: 999px;
              background: rgba(255,255,255,0.08);
              padding: 3px 8px;
              font-size: 12px;
            }
            .secondary {
              width: 100%;
              margin-top: auto;
              border: 1px solid var(--line);
              background: transparent;
              color: var(--text);
            }
            .content { min-width: 0; padding: 24px; }
            .content-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              margin-bottom: 18px;
            }
            .content-header h2 { margin-top: 4px; font-size: clamp(30px, 5vw, 52px); line-height: 1; }
            .header-action {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 44px;
              border: 1px solid rgba(216, 149, 0, 0.5);
              border-radius: 14px;
              background: rgba(216, 149, 0, 0.12);
              color: var(--accent-2);
              font-weight: 900;
              padding: 10px 14px;
              white-space: nowrap;
            }
            .overview-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 14px;
              margin-bottom: 18px;
            }
            .stat-card {
              min-height: 150px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border: 1px solid var(--line);
              border-left: 6px solid var(--accent);
              border-radius: 22px;
              background: linear-gradient(180deg, rgba(42, 18, 63, 0.96), rgba(31, 13, 49, 0.86));
              padding: 18px;
              box-shadow: 0 24px 70px rgba(0,0,0,0.18);
            }
            .stat-card span {
              color: var(--muted);
              font-size: 13px;
              font-weight: 850;
            }
            .stat-card strong {
              color: var(--text);
              font-size: clamp(34px, 6vw, 58px);
              line-height: 0.98;
            }
            .stat-card p {
              color: var(--muted);
              font-size: 12px;
              line-height: 1.4;
            }
            .overview-columns {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 18px;
              align-items: start;
            }
            .section-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 12px;
            }
            .section-head h3 { margin: 0; }
            .section-head a {
              color: var(--accent-2);
              font-size: 13px;
              font-weight: 900;
            }
            .table-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              margin-bottom: 18px;
            }
            .table-header h2 { margin-top: 4px; font-size: clamp(26px, 4vw, 42px); }
            .pager { display: flex; align-items: center; gap: 10px; color: var(--muted); }
            .pager span {
              border-radius: 14px;
              background: rgba(255,255,255,0.06);
              color: rgba(255,255,255,0.35);
              padding: 13px 16px;
              font-weight: 900;
            }
            .columns {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-bottom: 18px;
            }
            .columns span {
              border: 1px solid var(--line);
              border-radius: 999px;
              background: rgba(255,255,255,0.06);
              padding: 8px 12px;
              color: var(--text);
              font-size: 13px;
              font-weight: 800;
            }
            .columns small {
              margin-left: 6px;
              color: var(--muted);
              font-weight: 700;
            }
            .table-wrap {
              overflow: auto;
              border: 1px solid var(--line);
              border-radius: 18px;
              background: rgba(31, 13, 49, 0.85);
              box-shadow: 0 24px 70px rgba(0,0,0,0.24);
            }
            table { width: 100%; border-collapse: collapse; min-width: 760px; }
            th, td {
              max-width: 320px;
              border-bottom: 1px solid var(--line);
              padding: 12px 14px;
              text-align: left;
              vertical-align: top;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            th {
              position: sticky;
              top: 0;
              background: var(--panel-2);
              color: var(--accent-2);
              font-size: 12px;
              text-transform: uppercase;
            }
            td { color: var(--text); font-size: 13px; }
            tr:hover td { background: rgba(255,255,255,0.04); }
            .notice {
              margin-bottom: 16px;
              border-radius: 16px;
              border: 1px solid var(--line);
              padding: 14px 16px;
              font-weight: 850;
            }
            .notice.success {
              background: rgba(216, 149, 0, 0.14);
              border-color: rgba(216, 149, 0, 0.46);
              color: var(--accent-2);
            }
            .notice.error {
              background: rgba(255, 119, 119, 0.14);
              border-color: rgba(255, 119, 119, 0.45);
              color: var(--danger);
            }
            .main-tabs a {
              border-color: var(--line);
              background: rgba(255,255,255,0.04);
              font-weight: 850;
            }
            .table-list {
              min-height: 0;
              display: grid;
              gap: 10px;
            }
            .sidebar-label {
              color: var(--accent-2);
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .split-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
              gap: 18px;
              align-items: start;
            }
            .manage-grid {
              display: grid;
              grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
              gap: 18px;
              align-items: start;
            }
            .entity-list {
              position: sticky;
              top: 24px;
              max-height: calc(100vh - 48px);
              overflow: auto;
            }
            .entity-main {
              display: grid;
              gap: 18px;
              min-width: 0;
            }
            .ops-card {
              border: 1px solid var(--line);
              border-radius: 22px;
              background: rgba(31, 13, 49, 0.82);
              box-shadow: 0 24px 70px rgba(0,0,0,0.2);
              padding: 18px;
            }
            .ops-card h3 {
              margin: 0 0 10px;
              font-size: 18px;
              line-height: 1.2;
            }
            .form-grid {
              display: grid;
              gap: 16px;
            }
            .form-section {
              display: grid;
              gap: 12px;
              border-bottom: 1px solid var(--line);
              padding-bottom: 16px;
            }
            .form-section:last-of-type { border-bottom: 0; }
            .two-col, .three-col {
              display: grid;
              gap: 12px;
            }
            .two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .three-col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .full { grid-column: 1 / -1; }
            .hint {
              color: var(--muted);
              font-size: 13px;
              line-height: 1.45;
            }
            .checkbox-row {
              display: flex;
              align-items: center;
              gap: 10px;
              border: 1px solid var(--line);
              border-radius: 14px;
              padding: 12px;
              color: var(--text);
            }
            .checkbox-row input {
              width: 18px;
              height: 18px;
              padding: 0;
            }
            .logo-row-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
            }
            .logo-row {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(150px, 0.8fr);
              gap: 10px;
              align-items: end;
              border: 1px solid var(--line);
              border-radius: 16px;
              background: rgba(255,255,255,0.035);
              padding: 12px;
            }
            .primary-action {
              min-height: 50px;
              font-size: 15px;
            }
            .league-stack {
              display: grid;
              gap: 10px;
            }
            .league-card {
              display: grid;
              gap: 4px;
              border: 1px solid var(--line);
              border-radius: 16px;
              background: rgba(255,255,255,0.045);
              padding: 12px;
            }
            .entity-link {
              transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
            }
            .entity-link:hover,
            .entity-link.active {
              border-color: rgba(216, 149, 0, 0.55);
              background: rgba(216, 149, 0, 0.13);
            }
            .league-card strong {
              color: var(--text);
              line-height: 1.2;
            }
            .league-card span,
            .league-card small {
              color: var(--muted);
              font-size: 12px;
            }
            .user-card strong,
            .user-card span,
            .user-card small {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .status-chip {
              border: 1px solid rgba(216, 149, 0, 0.42);
              border-radius: 999px;
              background: rgba(216, 149, 0, 0.12);
              color: var(--accent-2);
              font-size: 12px;
              font-weight: 900;
              padding: 7px 10px;
              white-space: nowrap;
            }
            .mini-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
            }
            .mini-grid div {
              display: grid;
              gap: 3px;
              border: 1px solid var(--line);
              border-radius: 14px;
              background: rgba(255,255,255,0.045);
              padding: 12px;
            }
            .mini-grid strong {
              color: var(--text);
              font-size: 22px;
              line-height: 1;
            }
            .mini-grid span,
            .row-metric span {
              color: var(--muted);
              font-size: 12px;
            }
            .edit-list {
              display: grid;
              gap: 12px;
            }
            .edit-row {
              display: grid;
              grid-template-columns: minmax(180px, 1.2fr) minmax(180px, 1fr) auto;
              gap: 10px;
              align-items: end;
              border: 1px solid var(--line);
              border-radius: 16px;
              background: rgba(255,255,255,0.035);
              padding: 12px;
            }
            .venue-row {
              grid-template-columns: repeat(4, minmax(130px, 1fr)) auto;
            }
            .team-edit-row {
              grid-template-columns: minmax(180px, 1.2fr) minmax(180px, 1fr) minmax(180px, 1fr) auto auto;
            }
            .edit-row button {
              min-height: 47px;
              padding-inline: 18px;
            }
            .row-metric {
              display: grid;
              gap: 3px;
              min-width: 76px;
              border: 1px solid var(--line);
              border-radius: 14px;
              padding: 10px 12px;
            }
            .row-metric strong {
              color: var(--text);
              line-height: 1;
            }
            .empty-panel {
              min-height: 180px;
              display: grid;
              align-content: center;
              gap: 8px;
            }
            .import-notes {
              display: grid;
              gap: 10px;
              color: var(--muted);
              font-size: 13px;
              line-height: 1.45;
            }
            .import-notes strong { color: var(--text); }
            .compact-list {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 12px;
            }
            .compact-list span {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              border: 1px solid var(--line);
              border-radius: 999px;
              background: rgba(255,255,255,0.045);
              color: var(--text);
              font-size: 12px;
              font-weight: 850;
              padding: 7px 10px;
            }
            .compact-list small {
              color: var(--muted);
              font-weight: 700;
            }
            .checklist {
              border: 1px solid var(--line);
              border-radius: 16px;
              background: rgba(255,255,255,0.04);
              padding: 14px;
            }
            .checklist ol {
              margin: 10px 0 0;
              padding-left: 18px;
              color: var(--muted);
              display: grid;
              gap: 8px;
              font-size: 13px;
            }
            code {
              display: block;
              white-space: normal;
              border: 1px solid var(--line);
              border-radius: 14px;
              background: #11051b;
              color: var(--accent-2);
              padding: 12px;
              font-size: 13px;
            }
            @media (max-width: 860px) {
              .dashboard { grid-template-columns: 1fr; }
              .sidebar { position: relative; height: auto; }
              .content-header { flex-direction: column; }
              .header-action { width: 100%; }
              .overview-grid, .overview-columns { grid-template-columns: 1fr; }
              .manage-grid { grid-template-columns: 1fr; }
              .entity-list { position: static; max-height: none; }
              .mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .logo-row-grid, .logo-row { grid-template-columns: 1fr; }
              .edit-row, .venue-row { grid-template-columns: 1fr; }
              .table-header { flex-direction: column; }
              .pager { width: 100%; justify-content: space-between; }
              .split-grid, .two-col, .three-col { grid-template-columns: 1fr; }
            }
            @media (min-width: 861px) and (max-width: 1180px) {
              .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .edit-row, .venue-row, .team-edit-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .edit-row button { grid-column: 1 / -1; }
            }
          </style>
        </head>
        <body>${body}</body>
      </html>`
  }
}
