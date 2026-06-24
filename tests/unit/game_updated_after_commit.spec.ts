import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
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

test.group('Game afterSave defers GameUpdated until commit', (group) => {
  withFreshDatabaseAndCountries(group)

  group.setup(async () => {
    await app.init()
    await app.boot()
  })

  test('standings use committed score after transactional save', async ({ assert }) => {
    const owner = await User.create({
      email: `after-commit-${Date.now()}@kpakore.test`,
      password: 'password1',
      fullName: 'After Commit Tester',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'After Commit League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    const game = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.utc(),
      status: 'first_half',
      homeScore: 0,
      awayScore: 0,
    })

    const standingService = new StandingService()
    await standingService.recalculateForGame(season.id, home.id, away.id)

    const homeBefore = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(homeBefore.draws, 1)
    assert.equal(homeBefore.wins, 0)

    await db.transaction(async (trx) => {
      game.homeScore = 1
      game.useTransaction(trx)
      await game.save()
    })

    const homeAfter = await Standing.findByOrFail({ seasonId: season.id, teamId: home.id })
    assert.equal(homeAfter.wins, 1)
    assert.equal(homeAfter.draws, 0)
    assert.equal(homeAfter.points, 3)
    assert.equal(homeAfter.form, 'W')

    const awayAfter = await Standing.findByOrFail({ seasonId: season.id, teamId: away.id })
    assert.equal(awayAfter.losses, 1)
    assert.equal(awayAfter.points, 0)
    assert.equal(awayAfter.form, 'L')
  })
})
