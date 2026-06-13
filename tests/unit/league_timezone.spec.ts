import { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'
import User from '#models/user'
import LeagueService from '#services/league_service'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

const LAGOS = 'Africa/Lagos'
const GAME_DATE = '2026-05-23'

async function createUser() {
  return User.create({
    email: `tz-${Date.now()}-${Math.random().toString(36).slice(2)}@kpakore.test`,
    password: 'password1',
    fullName: 'Timezone Tester',
  })
}

function localCalendarDay(playedAtUtc: string, timeZone: string) {
  return DateTime.fromISO(playedAtUtc, { zone: 'utc' }).setZone(timeZone).toFormat('yyyy-MM-dd')
}

async function seedLeagueWithGames(
  games: Array<{ label: string; playedAt: DateTime; status?: string }>
) {
  const owner = await createUser()
  const ng = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    userId: owner.id,
    name: 'Timezone Test League',
    countryId: ng.id,
  })
  const season = await Season.create({
    leagueId: league.id,
    name: '2026 Spring',
    status: 'active',
  })
  const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
  const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

  const created = []
  for (const spec of games) {
    const game = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: spec.playedAt,
      status: spec.status ?? 'scheduled',
      homeScore: null,
      awayScore: null,
    })
    created.push({ ...spec, id: game.id })
  }

  return { league, created }
}

function collectGameIds(countries: Awaited<ReturnType<LeagueService['listLeagueByCountry']>>) {
  return countries.flatMap((country) =>
    country.leagues.flatMap((league) => league.games.map((game) => game.id))
  )
}

test.group('LeagueService timezone', (group) => {
  withFreshDatabaseAndCountries(group)

  test('resolveMatchDayWindow converts Lagos calendar day to UTC bounds', async ({ assert }) => {
    const service = new LeagueService()
    const window = service.resolveMatchDayWindow(GAME_DATE, LAGOS)

    assert.equal(window.playedAtStartUtc, '2026-05-22 23:00:00.000')
    assert.equal(window.playedAtEndUtc, '2026-05-23 22:59:59.999')
  })

  test('resolveMatchDayWindow uses UTC day when timeZone omitted', async ({ assert }) => {
    const service = new LeagueService()
    const window = service.resolveMatchDayWindow(GAME_DATE, undefined)

    assert.equal(window.playedAtStartUtc, '2026-05-23 00:00:00.000')
    assert.equal(window.playedAtEndUtc, '2026-05-23 23:59:59.999')
  })

  test('resolveMatchDayWindow throws 400 for invalid timeZone', async ({ assert }) => {
    const service = new LeagueService()
    try {
      service.resolveMatchDayWindow(GAME_DATE, 'Not/A/Zone')
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 400)
    }
  })

  test('resolveMatchDayWindow throws 400 for invalid gameDate', async ({ assert }) => {
    const service = new LeagueService()
    try {
      service.resolveMatchDayWindow('not-a-date', LAGOS)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 400)
    }
  })

  test('listLeagueByCountry includes games on Lagos local day only', async ({ assert }) => {
    const service = new LeagueService()

    const { created } = await seedLeagueWithGames([
      { label: 'late-lagos-may-23', playedAt: DateTime.fromISO('2026-05-23T22:30:00.000Z') },
      { label: 'early-lagos-may-23', playedAt: DateTime.fromISO('2026-05-22T23:30:00.000Z') },
      { label: 'lagos-may-24', playedAt: DateTime.fromISO('2026-05-23T23:30:00.000Z') },
    ])

    const byLabel = Object.fromEntries(created.map((g) => [g.label, g.id]))

    assert.equal(localCalendarDay('2026-05-23T22:30:00.000Z', LAGOS), GAME_DATE)
    assert.equal(localCalendarDay('2026-05-22T23:30:00.000Z', LAGOS), GAME_DATE)
    assert.equal(localCalendarDay('2026-05-23T23:30:00.000Z', LAGOS), '2026-05-24')

    const countries = await service.listLeagueByCountry(undefined, undefined, GAME_DATE, LAGOS)
    const gameIds = collectGameIds(countries)

    assert.include(gameIds, byLabel['late-lagos-may-23'])
    assert.include(gameIds, byLabel['early-lagos-may-23'])
    assert.notInclude(gameIds, byLabel['lagos-may-24'])
  })

  test('same instant falls on different calendar days for UTC vs Lagos filters', async ({
    assert,
  }) => {
    const service = new LeagueService()

    const { created } = await seedLeagueWithGames([
      { label: 'boundary', playedAt: DateTime.fromISO('2026-05-22T23:30:00.000Z') },
    ])
    const gameId = created[0].id

    assert.equal(localCalendarDay('2026-05-22T23:30:00.000Z', 'UTC'), '2026-05-22')
    assert.equal(localCalendarDay('2026-05-22T23:30:00.000Z', LAGOS), GAME_DATE)

    const utcDay = await service.listLeagueByCountry(
      undefined,
      undefined,
      '2026-05-22',
      'UTC'
    )
    const lagosDay = await service.listLeagueByCountry(
      undefined,
      undefined,
      GAME_DATE,
      LAGOS
    )

    assert.include(collectGameIds(utcDay), gameId)
    assert.include(collectGameIds(lagosDay), gameId)

    const utcMay23 = await service.listLeagueByCountry(
      undefined,
      undefined,
      GAME_DATE,
      'UTC'
    )
    const lagosMay22 = await service.listLeagueByCountry(
      undefined,
      undefined,
      '2026-05-22',
      LAGOS
    )

    assert.notInclude(collectGameIds(utcMay23), gameId)
    assert.notInclude(collectGameIds(lagosMay22), gameId)
  })
})
