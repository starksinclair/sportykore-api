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
import StandingService from '#services/standing_service'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

test.group('StandingService compat (blocking)', (group) => {
  withFreshDatabaseAndCountries(group)

  test('recalculates and sorts pts > GD > GF > name', async ({ assert }) => {
    const owner = await User.create({
      email: `compat-${Date.now()}@standings.test`,
      password: 'password1',
      fullName: 'Compat Owner',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Compat League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const stage = await new StageService().ensureRoundRobinStage(season.id)

    const alpha = await Team.create({ leagueId: league.id, name: 'Alpha FC', addedBy: owner.id })
    const bravo = await Team.create({ leagueId: league.id, name: 'Bravo FC', addedBy: owner.id })
    const charlie = await Team.create({
      leagueId: league.id,
      name: 'Charlie FC',
      addedBy: owner.id,
    })

    // Charlie beats Alpha 3–0, Charlie beats Bravo 3–2, Bravo beats Alpha 1–0
    // Charlie: 6 pts, GD +4, GF 6
    // Bravo:   3 pts, GD  0, GF 3
    // Alpha:   0 pts, GD -4, GF 0
    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: charlie.id,
      awayTeamId: alpha.id,
      playedAt: DateTime.utc(),
      status: 'full_time',
      homeScore: 3,
      awayScore: 0,
    })
    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: charlie.id,
      awayTeamId: bravo.id,
      playedAt: DateTime.utc().plus({ hours: 1 }),
      status: 'full_time',
      homeScore: 3,
      awayScore: 2,
    })
    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: bravo.id,
      awayTeamId: alpha.id,
      playedAt: DateTime.utc().plus({ hours: 2 }),
      status: 'full_time',
      homeScore: 1,
      awayScore: 0,
    })

    const service = new StandingService()
    await service.ensureForTeams(league.id, season.id, [alpha.id, bravo.id, charlie.id])
    await service.recalculateForGame(season.id, charlie.id, alpha.id)
    await service.recalculateForGame(season.id, charlie.id, bravo.id)
    await service.recalculateForGame(season.id, bravo.id, alpha.id)

    const standings = await Standing.query()
      .where('season_id', season.id)
      .orderBy('position', 'asc')
      .preload('team')

    assert.lengthOf(standings, 3)
    assert.deepEqual(
      standings.map((row) => ({
        position: row.position,
        teamName: row.team.name,
        points: row.points,
        goalDifference: row.goalDifference,
        goalsFor: row.goalsFor,
      })),
      [
        { position: 1, teamName: 'Charlie FC', points: 6, goalDifference: 4, goalsFor: 6 },
        { position: 2, teamName: 'Bravo FC', points: 3, goalDifference: 0, goalsFor: 3 },
        { position: 3, teamName: 'Alpha FC', points: 0, goalDifference: -4, goalsFor: 0 },
      ]
    )
  })

  test('breaks remaining ties by team name ascending', async ({ assert }) => {
    const owner = await User.create({
      email: `compat-tie-${Date.now()}@standings.test`,
      password: 'password1',
      fullName: 'Compat Tie Owner',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Tie Sort League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })
    const stage = await new StageService().ensureRoundRobinStage(season.id)

    const zebra = await Team.create({ leagueId: league.id, name: 'Zebra', addedBy: owner.id })
    const aardvark = await Team.create({
      leagueId: league.id,
      name: 'Aardvark',
      addedBy: owner.id,
    })
    const filler = await Team.create({
      leagueId: league.id,
      name: 'Filler',
      addedBy: owner.id,
    })

    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: zebra.id,
      awayTeamId: filler.id,
      playedAt: DateTime.utc(),
      status: 'full_time',
      homeScore: 1,
      awayScore: 0,
    })
    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      stageId: stage.id,
      homeTeamId: aardvark.id,
      awayTeamId: filler.id,
      playedAt: DateTime.utc().plus({ hours: 1 }),
      status: 'full_time',
      homeScore: 1,
      awayScore: 0,
    })

    const service = new StandingService()
    await service.ensureForTeams(league.id, season.id, [zebra.id, aardvark.id, filler.id])
    await service.recalculateForGame(season.id, zebra.id, filler.id)
    await service.recalculateForGame(season.id, aardvark.id, filler.id)

    const standings = await Standing.query()
      .where('season_id', season.id)
      .orderBy('position', 'asc')
      .preload('team')

    assert.equal(standings[0]!.team.name, 'Aardvark')
    assert.equal(standings[1]!.team.name, 'Zebra')
    assert.equal(standings[0]!.points, standings[1]!.points)
    assert.equal(standings[0]!.goalDifference, standings[1]!.goalDifference)
    assert.equal(standings[0]!.goalsFor, standings[1]!.goalsFor)
  })
})
