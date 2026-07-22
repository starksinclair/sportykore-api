import { DateTime } from 'luxon'
import { test } from '@japa/runner'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Standing from '#models/standing'
import Team from '#models/team'
import User from '#models/user'
import StageService from '#services/stage_service'
import StandingAdjustmentService from '#services/standing_adjustment_service'
import StandingService from '#services/standing_service'
import { TeamService } from '#services/team_service'
import LeagueService from '#services/league_service'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

async function createLeagueSeasonTeams(label: string) {
  const owner = await User.create({
    email: `standing-${label}-${Date.now()}@kpakore.test`,
    password: 'password1',
    fullName: 'Standing Tester',
  })
  const ng = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    userId: owner.id,
    name: `${label} League`,
    countryId: ng.id,
  })
  const season = await Season.create({
    leagueId: league.id,
    name: '2026',
    status: 'active',
  })
  const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
  const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })
  const stage = await new StageService().ensureRoundRobinStage(season.id)

  return { owner, league, season, home, away, stage }
}

test.group('StandingService recalculate', (group) => {
  withFreshDatabaseAndCountries(group)

  test('counts in-progress games once kickoff has started', async ({ assert }) => {
    const { league, season, home, away, stage } = await createLeagueSeasonTeams('live')

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.utc(),
      status: 'first_half',
      homeScore: 1,
      awayScore: 0,
    })

    const service = new StandingService()
    await service.recalculateForGame(season.id, home.id, away.id)

    const homeStanding = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    const awayStanding = await Standing.findByOrFail({ seasonId: season.id, teamId: away.id })

    assert.equal(homeStanding.played, 1)
    assert.equal(homeStanding.wins, 1)
    assert.equal(homeStanding.points, 3)
    assert.equal(homeStanding.form, 'W')
    assert.equal(awayStanding.played, 1)
    assert.equal(awayStanding.losses, 1)
    assert.equal(awayStanding.points, 0)
    assert.equal(awayStanding.form, 'L')
  })

  test('kickoff with null scores records a draw in form and standings', async ({ assert }) => {
    const { league, season, home, away, stage } = await createLeagueSeasonTeams('draw')

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.utc(),
      status: 'first_half',
      homeScore: null,
      awayScore: null,
    })

    const service = new StandingService()
    await service.recalculateForGame(season.id, home.id, away.id)

    const homeStanding = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    const awayStanding = await Standing.findByOrFail({ seasonId: season.id, teamId: away.id })

    assert.equal(homeStanding.played, 1)
    assert.equal(homeStanding.draws, 1)
    assert.equal(homeStanding.points, 1)
    assert.equal(homeStanding.form, 'D')
    assert.equal(awayStanding.draws, 1)
    assert.equal(awayStanding.points, 1)
    assert.equal(awayStanding.form, 'D')
  })

  test('form keeps the last five results in chronological order', async ({ assert }) => {
    const { owner, league, season, home, stage } = await createLeagueSeasonTeams('form')
    const opponents = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        Team.create({
          leagueId: league.id,
          name: `Opp ${index + 1}`,
          addedBy: owner.id,
        })
      )
    )

    const outcomes = ['W', 'D', 'L', 'W', 'D', 'L'] as const
    for (const [index, opponent] of opponents.entries()) {
      await Game.create({
        leagueId: league.id,
        seasonId: season.id,
        stageId: stage.id,
        homeTeamId: home.id,
        awayTeamId: opponent.id,
        playedAt: DateTime.utc().plus({ days: index }),
        status: 'full_time',
        homeScore: outcomes[index] === 'W' ? 2 : outcomes[index] === 'D' ? 1 : 0,
        awayScore: outcomes[index] === 'L' ? 2 : outcomes[index] === 'D' ? 1 : 0,
      })
    }

    const service = new StandingService()
    await service.recalculateTeam(season.id, home.id)

    const standing = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(standing.form, 'D,L,W,D,L')
  })

  test('does not count scheduled games', async ({ assert }) => {
    const { league, season, home, away, stage } = await createLeagueSeasonTeams('sched')

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.utc().plus({ days: 1 }),
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    })

    const service = new StandingService()
    await service.recalculate(season.id, home.id)

    const standing = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(standing.played, 0)
    assert.equal(standing.points, 0)
  })
})

test.group('StandingService — standing_adjustments applied everywhere', (group) => {
  withFreshDatabaseAndCountries(group)

  test('a deduction created after a game result is folded into recalculateTeam', async ({
    assert,
  }) => {
    const { league, season, home, away, stage } = await createLeagueSeasonTeams('adj-recalc')

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.utc(),
      status: 'full_time',
      homeScore: 2,
      awayScore: 0,
    })

    const standingService = new StandingService()
    await standingService.recalculateForGame(season.id, home.id, away.id)

    const beforeDeduction = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(beforeDeduction.points, 3)

    const adjustments = new StandingAdjustmentService()
    await adjustments.create(stage.id, {
      teamId: home.id,
      pointsDelta: -3,
      reason: 'Fielded an ineligible player',
    })

    const afterDeduction = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(afterDeduction.points, 0)

    // Deleting the adjustment restores the pre-deduction points immediately.
    const created = await adjustments.list(stage.id)
    await adjustments.destroy(created[0]!.id)
    const restored = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(restored.points, 3)
  })

  test('the deduction is visible through GET /leagues/:leagueId and GET /teams/:id', async ({
    assert,
  }) => {
    const { league, season, home, away, stage } = await createLeagueSeasonTeams('adj-endpoints')

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.utc(),
      status: 'full_time',
      homeScore: 1,
      awayScore: 0,
    })

    const standingService = new StandingService()
    await standingService.recalculateForGame(season.id, home.id, away.id)

    const adjustments = new StandingAdjustmentService()
    await adjustments.create(stage.id, {
      teamId: home.id,
      pointsDelta: -5,
      reason: 'Salary cap breach',
    })

    const leagueService = new LeagueService(standingService)
    const { season: leagueDetailSeason } = await leagueService.getLeague(league.id, season.id)
    const leagueRow = leagueDetailSeason.standings.find((row) => row.teamId === home.id)
    assert.equal(leagueRow?.points, -2)

    const teamService = new TeamService()
    const { leagues } = await teamService.getTeamDetail(home.id)
    const teamSeason = leagues[0]!.seasons.find((row) => row.season.id === season.id)
    const teamRow = teamSeason?.standings.find((row) => row.teamId === home.id)
    assert.equal(teamRow?.points, -2)
  })
})
