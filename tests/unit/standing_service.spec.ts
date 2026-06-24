import { DateTime } from 'luxon'
import { test } from '@japa/runner'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Standing from '#models/standing'
import Team from '#models/team'
import User from '#models/user'
import StandingService from '#services/standing_service'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

test.group('StandingService recalculate', (group) => {
  withFreshDatabaseAndCountries(group)

  test('counts in-progress games once kickoff has started', async ({ assert }) => {
    const owner = await User.create({
      email: `standing-${Date.now()}@kpakore.test`,
      password: 'password1',
      fullName: 'Standing Tester',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Live Standings League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
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
    const owner = await User.create({
      email: `standing-draw-${Date.now()}@kpakore.test`,
      password: 'password1',
      fullName: 'Standing Tester',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Kickoff Draw League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
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
    const owner = await User.create({
      email: `standing-form-${Date.now()}@kpakore.test`,
      password: 'password1',
      fullName: 'Standing Tester',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Form League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
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
    const owner = await User.create({
      email: `standing-sched-${Date.now()}@kpakore.test`,
      password: 'password1',
      fullName: 'Standing Tester',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Scheduled League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
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
