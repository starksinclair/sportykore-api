import { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Player from '#models/player'
import Season from '#models/season'
import Standing from '#models/standing'
import Stat from '#models/stat'
import StatType from '#models/stat_type'
import Team from '#models/team'
import User from '#models/user'
import LeagueService from '#services/league_service'
import CountryTransformer from '#transformers/country_transformer'
import GameTransformer from '#transformers/game_transformer'
import LeagueTransformer from '#transformers/league_transformer'
import TeamTransformer from '#transformers/team_transformer'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

async function createUser() {
  return User.create({
    email: `league-svc-${Date.now()}-${Math.random().toString(36).slice(2)}@kpakore.test`,
    fullName: 'League Service Tester',
  })
}

test.group('LeagueService', (group) => {
  withFreshDatabaseAndCountries(group)

  test('createWithSeason creates league, active season, and optional teams', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    const { league, season, teams } = await service.createWithSeason(owner.id, {
      name: 'Test League',
      description: 'Desc',
      countryId: ng.id,
      seasonName: '2025/26',
      teams: [{ name: 'Side A' }, { name: 'Side B' }],
    })

    assert.isTrue(league.$isPersisted)
    assert.equal(league.userId, owner.id)
    assert.equal(league.countryId, ng.id)
    assert.equal(league.name, 'Test League')
    assert.equal(season.status, 'active')
    assert.lengthOf(teams, 2)

    await league.load('games')
    const ref = new LeagueTransformer(league).toObject()
    assert.equal(ref.name, 'Test League')
  })

  test('listCountriesWithLeagues returns countries that have leagues', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')
    const gh = await Country.findByOrFail('code', 'gh')

    await League.create({ userId: owner.id, name: 'Zebra League', countryId: ng.id })
    await League.create({ userId: owner.id, name: 'Alpha League', countryId: ng.id })
    await League.create({ userId: owner.id, name: 'Ghana Only', countryId: gh.id })

    const countries = await service.listCountriesWithLeagues()
    assert.lengthOf(countries, 2)
    assert.equal(countries[0].name, 'Ghana')
    assert.equal(countries[1].name, 'Nigeria')
    assert.lengthOf(countries[1].leagues, 2)
  })

  test('listCountriesWithLeagues filters by country id', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    await League.create({ userId: owner.id, name: 'Only NG', countryId: ng.id })

    const countries = await service.listCountriesWithLeagues(ng.id)
    assert.lengthOf(countries, 1)
    assert.equal(countries[0].code, 'ng')
    assert.lengthOf(countries[0].leagues, 1)
  })

  test('listLeagueByCountry returns games on the requested calendar day', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    const league = await League.create({
      userId: owner.id,
      name: 'Match League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: 'Current',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    const playedAt = DateTime.utc(2026, 6, 20, 15, 0, 0)
    const todayGame = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt,
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    })
    await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: playedAt.plus({ days: 1 }),
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    })

    const countries = await service.listLeagueByCountry(
      ng.id,
      undefined,
      '2026-06-20',
      'UTC',
      undefined
    )

    assert.lengthOf(countries, 1)
    assert.lengthOf(countries[0].leagues, 1)
    assert.lengthOf(countries[0].leagues[0].games, 1)
    assert.equal(countries[0].leagues[0].games[0].id, todayGame.id)
  })

  test('listLeagueByCountry throws 400 for invalid country id', async ({ assert }) => {
    const service = new LeagueService()
    try {
      await service.listLeagueByCountry(-1, undefined, undefined, undefined, undefined)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 400)
    }
  })

  test('resolveMatchDayWindow builds UTC bounds for a calendar day', ({ assert }) => {
    const service = new LeagueService()
    const window = service.resolveMatchDayWindow('2026-06-20', 'UTC')

    assert.equal(window.playedAtStartUtc, '2026-06-20 00:00:00.000')
    assert.equal(window.playedAtEndUtc, '2026-06-20 23:59:59.999')
  })

  test('resolveMatchDayWindow throws 400 for invalid gameDate', ({ assert }) => {
    const service = new LeagueService()
    try {
      service.resolveMatchDayWindow('not-a-date', 'UTC')
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 400)
    }
  })

  test('resolveMatchDayWindow throws 400 for invalid timeZone', ({ assert }) => {
    const service = new LeagueService()
    try {
      service.resolveMatchDayWindow('2026-06-20', 'Not/A/Zone')
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 400)
    }
  })

  test('getLeague throws 404 when league id missing', async ({ assert }) => {
    const service = new LeagueService()
    try {
      await service.getLeague(9_999_999)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 404)
    }
  })

  test('getLeague throws 404 when league has no seasons', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'No Season Yet',
      countryId: ng.id,
    })

    try {
      await service.getLeague(league.id)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 404)
      assert.equal((error as Exception).message, 'League has no seasons')
    }
  })

  test('getLeague returns season detail with games, standings, and stats', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    const league = await League.create({
      userId: owner.id,
      name: 'Standings League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: 'S1',
      status: 'active',
    })

    const teamA = await Team.create({ leagueId: league.id, name: 'A United', addedBy: owner.id })
    const teamB = await Team.create({ leagueId: league.id, name: 'B City', addedBy: owner.id })

    const playedAt = DateTime.utc().minus({ days: 1 })
    const game = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      playedAt,
      status: 'full_time',
      homeScore: 2,
      awayScore: 0,
    })

    await Standing.create({
      leagueId: league.id,
      seasonId: season.id,
      teamId: teamA.id,
      position: 1,
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDifference: 2,
      points: 3,
      form: 'W',
    })
    await Standing.create({
      leagueId: league.id,
      seasonId: season.id,
      teamId: teamB.id,
      position: 2,
      played: 1,
      wins: 0,
      draws: 0,
      losses: 1,
      goalsFor: 0,
      goalsAgainst: 2,
      goalDifference: -2,
      points: 0,
      form: 'L',
    })

    const statType = await StatType.create({
      name: 'goals',
      displayName: 'Goals',
      category: 'performance',
      iconName: null,
    })

    const playerUser = await createUser()
    const player = await Player.create({
      userId: playerUser.id,
      name: 'Striker',
      addedBy: owner.id,
      countryId: ng.id,
    })

    await Stat.create({
      leagueId: league.id,
      seasonId: season.id,
      gameId: game.id,
      statTypeId: statType.id,
      teamId: teamA.id,
      playerId: player.id,
      minute: 12,
      value: '1',
      numericValue: 1,
      isStoppageTime: false,
      relatedPlayerId: null,
    })

    const { seasons, season: detailSeason, statTypes } = await service.getLeague(league.id)

    assert.lengthOf(seasons, 1)
    assert.equal(detailSeason.id, season.id)
    assert.lengthOf(detailSeason.games, 1)
    assert.equal(detailSeason.games[0].status, 'full_time')

    const gameJson = new GameTransformer(detailSeason.games[0]).toObject()
    assert.equal(gameJson.homeScore, 2)
    assert.equal(gameJson.awayScore, 0)

    assert.lengthOf(detailSeason.standings, 2)
    assert.equal(detailSeason.standings[0].position, 1)
    assert.equal(detailSeason.standings[0].team.name, 'A United')
    assert.equal(detailSeason.standings[0].points, 3)

    assert.lengthOf(detailSeason.stats, 1)
    assert.equal(detailSeason.stats[0].type.name, 'goals')
    assert.equal(detailSeason.stats[0].player?.name, 'Striker')
    assert.isAbove(statTypes.length, 0)
  })

  test('getLeague throws 404 when seasonId does not belong to league', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    const leagueA = await League.create({
      userId: owner.id,
      name: 'League A',
      countryId: ng.id,
    })
    const leagueB = await League.create({
      userId: owner.id,
      name: 'League B',
      countryId: ng.id,
    })
    const seasonB = await Season.create({
      leagueId: leagueB.id,
      name: 'B Season',
      status: 'active',
    })
    await Season.create({
      leagueId: leagueA.id,
      name: 'A Season',
      status: 'active',
    })

    try {
      await service.getLeague(leagueA.id, seasonB.id)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 404)
    }
  })

  test('CountryTransformer forList exposes id, name, and code', async ({ assert }) => {
    const country = new Country()
    country.merge({ id: 1, name: 'Nigeria', code: 'ng', flagUrl: 'https://example.com/f.png' })
    const ref = new CountryTransformer(country).forList()
    assert.deepEqual(ref, { id: 1, name: 'Nigeria', code: 'ng' })
  })

  test('TeamTransformer serializes core fields', async ({ assert }) => {
    const team = new Team()
    team.merge({ id: 1, name: 'Riverside United', logoUrl: null })
    assert.deepEqual(new TeamTransformer(team).toObject(), {
      id: 1,
      name: 'Riverside United',
      logoUrl: null,
    })
  })
})
