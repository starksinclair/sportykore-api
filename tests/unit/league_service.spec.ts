import { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Player from '#models/player'
import Season from '#models/season'
import Stat from '#models/stat'
import StatType from '#models/stat_type'
import Team from '#models/team'
import User from '#models/user'
import LeagueService from '#services/league_service'
import ApiMatchTransformer from '#transformers/api_match_transformer'
import CountryTransformer from '#transformers/country_transformer'
import LeagueRefTransformer from '#transformers/league_ref_transformer'
import TeamTransformer from '#transformers/team_transformer'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

async function createUser() {
  return User.create({
    email: `league-svc-${Date.now()}-${Math.random().toString(36).slice(2)}@kpakore.test`,
    password: 'password1',
    fullName: 'League Service Tester',
  })
}

test.group('LeagueService', (group) => {
  withFreshDatabaseAndCountries(group)

  test('resolveCountry finds by lowercase code', async ({ assert }) => {
    const service = new LeagueService()
    const country = await service.resolveCountry('NG')
    assert.equal(country.code, 'ng')
    assert.equal(country.name, 'Nigeria')
  })

  test('resolveCountry finds by numeric id', async ({ assert }) => {
    const service = new LeagueService()
    const ng = await Country.findByOrFail('code', 'ng')
    const country = await service.resolveCountry(String(ng.id))
    assert.equal(country.id, ng.id)
  })

  test('resolveCountry trims whitespace', async ({ assert }) => {
    const service = new LeagueService()
    const country = await service.resolveCountry('  gh  ')
    assert.equal(country.code, 'gh')
  })

  test('resolveCountry throws 400 when ref is empty after trim', async ({ assert }) => {
    const service = new LeagueService()
    try {
      await service.resolveCountry('   ')
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 400)
    }
  })

  test('resolveCountry throws 404 for unknown code', async ({ assert }) => {
    const service = new LeagueService()
    try {
      await service.resolveCountry('xx')
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 404)
    }
  })

  test('resolveCountry throws 404 for unknown numeric id', async ({ assert }) => {
    const service = new LeagueService()
    try {
      await service.resolveCountry('999999')
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 404)
    }
  })

  test('createWithSeason creates league and active season and loads country', async ({
    assert,
  }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    const { league, season } = await service.createWithSeason(owner.id, {
      name: 'Test League',
      description: 'Desc',
      countryId: ng.id,
      seasonName: '2025/26',
    })

    assert.isTrue(league.$isPersisted)
    assert.equal(league.userId, owner.id)
    assert.equal(league.countryId, ng.id)
    assert.equal(league.name, 'Test League')
    assert.equal(league.description, 'Desc')

    assert.isTrue(season.$isPersisted)
    assert.equal(season.leagueId, league.id)
    assert.equal(season.name, '2025/26')
    assert.equal(season.status, 'active')

    await league.refresh()
    await league.load('country')
    const ref = new LeagueRefTransformer(league).toObject()
    assert.equal(ref.id, String(league.id))
    assert.equal(ref.name, 'Test League')
    assert.equal(ref.country.code, 'ng')
  })

  test('listLeagueRefsByCountry returns leagues for that country ordered by name', async ({
    assert,
  }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')
    const gh = await Country.findByOrFail('code', 'gh')

    await League.create({
      userId: owner.id,
      name: 'Zebra League',
      countryId: ng.id,
    })
    await League.create({
      userId: owner.id,
      name: 'Alpha League',
      countryId: ng.id,
    })
    await League.create({
      userId: owner.id,
      name: 'Ghana Only',
      countryId: gh.id,
    })

    const leagues = await service.listLeagueRefsByCountry('ng')
    assert.lengthOf(leagues, 2)
    assert.equal(leagues[0].name, 'Alpha League')
    assert.equal(leagues[1].name, 'Zebra League')
    assert.equal(leagues[0].country?.code, 'ng')
  })

  test('listLeagueRefsByCountry returns empty array when no leagues', async ({ assert }) => {
    const service = new LeagueService()
    const refs = await service.listLeagueRefsByCountry('gh')
    assert.deepEqual(refs, [])
  })

  test('listLeaguesWithMatchesByCountry returns matches for active season only', async ({
    assert,
  }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')

    const league = await League.create({
      userId: owner.id,
      name: 'Match League',
      countryId: ng.id,
    })

    const oldSeason = await Season.create({
      leagueId: league.id,
      name: 'Old',
      status: 'completed',
    })
    const activeSeason = await Season.create({
      leagueId: league.id,
      name: 'Current',
      status: 'active',
    })

    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    const playedAt = DateTime.utc().plus({ days: 1 })
    await Game.create({
      leagueId: league.id,
      seasonId: oldSeason.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt,
      status: 'completed',
      homeScore: 9,
      awayScore: 0,
    })
    const activeGame = await Game.create({
      leagueId: league.id,
      seasonId: activeSeason.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: playedAt.plus({ hours: 2 }),
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    })

    const rows = await service.listLeaguesWithMatchesByCountry('ng')
    assert.lengthOf(rows, 1)
    assert.lengthOf(rows[0].matches, 1)
    assert.equal(rows[0].matches[0].id, activeGame.id)
    const matchJson = new ApiMatchTransformer(
      rows[0].matches[0],
      String(league.id),
      'NG'
    ).toObject()
    assert.equal(matchJson.scoreline, '— : —')
  })

  test('getLeagueDetail throws 404 when league id missing', async ({ assert }) => {
    const service = new LeagueService()
    try {
      await service.getLeagueDetail(9_999_999)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 404)
    }
  })

  test('getLeagueDetail returns empty matches when no seasons', async ({ assert }) => {
    const service = new LeagueService()
    const owner = await createUser()
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'No Season Yet',
      countryId: ng.id,
    })

    const detail = await service.getLeagueDetail(league.id)
    assert.equal(detail.league.id, league.id)
    assert.isNull(detail.season)
    assert.deepEqual(detail.games, [])
    assert.deepEqual(detail.standings, [])
    assert.deepEqual(detail.stats, [])
  })

  test('getLeagueDetail builds standings and stats from completed games', async ({ assert }) => {
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
      status: 'completed',
      homeScore: 2,
      awayScore: 0,
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

    const detail = await service.getLeagueDetail(league.id)
    assert.equal(detail.season?.id, season.id)
    assert.lengthOf(detail.games, 1)
    assert.equal(detail.games[0].status, 'completed')
    const matchJson = new ApiMatchTransformer(detail.games[0], String(league.id), 'NG').toObject()
    assert.equal(matchJson.scoreline, '2 - 0')

    assert.lengthOf(detail.standings, 2)
    const first = detail.standings[0]
    assert.equal(first.position, 1)
    assert.equal(first.team.name, 'A United')
    assert.equal(first.points, 3)
    assert.equal(first.played, 1)
    assert.deepEqual(first.form, ['W'])

    assert.lengthOf(detail.stats, 1)
    assert.equal(detail.stats[0].type.name, 'goals')
    assert.equal(detail.stats[0].type.displayName, 'Goals')
    assert.equal(detail.stats[0].player?.name, 'Striker')
  })

  test('CountryTransformer includes flagUrl when set', async ({ assert }) => {
    const country = new Country()
    country.merge({ id: 1, name: 'X', code: 'x', flagUrl: 'https://example.com/f.png' })
    const ref = new CountryTransformer(country).toObject()
    assert.equal(ref.flagUrl, 'https://example.com/f.png')
  })

  test('TeamTransformer uses Unknown when name missing', async ({ assert }) => {
    const team = new Team()
    team.merge({ id: 1, name: null })
    assert.equal(new TeamTransformer(team).toObject().name, 'Unknown')
  })

  test('LeagueRefTransformer throws when country relation not loaded', async ({ assert }) => {
    const league = new League()
    league.merge({ id: 1, name: 'L', countryId: 1 })
    try {
      new LeagueRefTransformer(league).toObject()
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 500)
    }
  })
})
