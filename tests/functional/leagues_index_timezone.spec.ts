import env from '#start/env'
import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'
import User from '#models/user'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

const jsonHeaders = {
  Accept: 'application/json',
} as const

const LAGOS = 'Africa/Lagos'
const GAME_DATE = '2026-05-23'

function apiUrl(path: string) {
  const base = env.get('APP_URL').replace(/\/$/, '')
  return `${base}${path}`
}

async function readJson(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { _raw: text }
  }
}

function localCalendarDay(playedAtIso: string, timeZone: string) {
  return DateTime.fromISO(playedAtIso, { zone: 'utc' }).setZone(timeZone).toFormat('yyyy-MM-dd')
}

function collectMatchesGames(body: { data?: { matches?: unknown[] } }) {
  const games: Array<{ id: number; playedAt: string }> = []
  for (const country of body.data?.matches ?? []) {
    const leagues = (country as { leagues?: Array<{ games?: Array<{ id: number; playedAt: string }> }> })
      .leagues ?? []
    for (const league of leagues) {
      for (const game of league.games ?? []) {
        games.push(game)
      }
    }
  }
  return games
}

async function seedTimezoneFixture() {
  const owner = await User.create({
    email: `tz-index-${Date.now()}@kpakore.test`,
    password: 'password1',
    fullName: 'Index TZ Owner',
  })
  const ng = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    userId: owner.id,
    name: 'Index Timezone League',
    countryId: ng.id,
  })
  const season = await Season.create({
    leagueId: league.id,
    name: '2026 Spring',
    status: 'active',
  })
  const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
  const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

  const specs = [
    { key: 'evening-lagos', playedAt: '2026-05-23T20:00:00.000Z' },
    { key: 'early-lagos', playedAt: '2026-05-22T23:30:00.000Z' },
    { key: 'next-lagos-day', playedAt: '2026-05-23T23:30:00.000Z' },
  ] as const

  const byKey: Record<string, { id: number; playedAt: string }> = {}

  for (const spec of specs) {
    const game = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.fromISO(spec.playedAt, { zone: 'utc' }),
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    })
    byKey[spec.key] = { id: game.id, playedAt: spec.playedAt }
  }

  return byKey
}

test.group('Leagues index timezone API', (group) => {
  withFreshDatabaseAndCountries(group)

  test('GET /api/v1/leagues filters matches by gameDate in Africa/Lagos', async ({ assert }) => {
    const games = await seedTimezoneFixture()

    assert.equal(localCalendarDay(games['evening-lagos'].playedAt, LAGOS), GAME_DATE)
    assert.equal(localCalendarDay(games['early-lagos'].playedAt, LAGOS), GAME_DATE)
    assert.equal(localCalendarDay(games['next-lagos-day'].playedAt, LAGOS), '2026-05-24')

    const res = await fetch(
      apiUrl(
        `/api/v1/leagues?gameDate=${GAME_DATE}&timeZone=${encodeURIComponent(LAGOS)}`
      ),
      { headers: { ...jsonHeaders } }
    )

    assert.equal(res.status, 200)
    const body = await readJson(res)
    const returned = collectMatchesGames(body)
    const returnedIds = returned.map((g) => g.id)

    assert.include(returnedIds, games['evening-lagos'].id)
    assert.include(returnedIds, games['early-lagos'].id)
    assert.notInclude(returnedIds, games['next-lagos-day'].id)

    for (const game of returned) {
      assert.equal(
        localCalendarDay(game.playedAt, LAGOS),
        GAME_DATE,
        `game ${game.id} should be on ${GAME_DATE} in ${LAGOS}`
      )
    }

    assert.equal(body.data?.matchDay?.gameDate, GAME_DATE)
    assert.equal(body.data?.matchDay?.timeZone, LAGOS)
  })

  test('GET /api/v1/leagues uses Time-Zone header when timeZone query is omitted', async ({
    assert,
  }) => {
    const games = await seedTimezoneFixture()

    const res = await fetch(apiUrl(`/api/v1/leagues?gameDate=${GAME_DATE}`), {
      headers: {
        ...jsonHeaders,
        'Time-Zone': LAGOS,
      },
    })

    assert.equal(res.status, 200)
    const body = await readJson(res)
    const returnedIds = collectMatchesGames(body).map((g) => g.id)

    assert.include(returnedIds, games['evening-lagos'].id)
    assert.include(returnedIds, games['early-lagos'].id)
    assert.notInclude(returnedIds, games['next-lagos-day'].id)
    assert.equal(body.data?.matchDay?.gameDate, GAME_DATE)
    assert.equal(body.data?.matchDay?.timeZone, LAGOS)
  })

  test('GET /api/v1/leagues returns different matches for UTC vs Lagos on same gameDate', async ({
    assert,
  }) => {
    const owner = await User.create({
      email: `tz-compare-${Date.now()}@kpakore.test`,
      password: 'password1',
      fullName: 'Compare TZ',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Compare TZ League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026 Spring',
      status: 'active',
    })
    const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
    const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })

    const playedAt = '2026-05-22T23:30:00.000Z'
    const game = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      playedAt: DateTime.fromISO(playedAt, { zone: 'utc' }),
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    })

    const utcRes = await fetch(
      apiUrl('/api/v1/leagues?gameDate=2026-05-22&timeZone=UTC'),
      { headers: { ...jsonHeaders } }
    )
    const lagosRes = await fetch(
      apiUrl(
        `/api/v1/leagues?gameDate=${GAME_DATE}&timeZone=${encodeURIComponent(LAGOS)}`
      ),
      { headers: { ...jsonHeaders } }
    )

    assert.equal(utcRes.status, 200)
    assert.equal(lagosRes.status, 200)

    const utcIds = collectMatchesGames(await readJson(utcRes)).map((g) => g.id)
    const lagosIds = collectMatchesGames(await readJson(lagosRes)).map((g) => g.id)

    assert.include(utcIds, game.id)
    assert.include(lagosIds, game.id)

    const utcMay23 = collectMatchesGames(
      await readJson(
        await fetch(apiUrl('/api/v1/leagues?gameDate=2026-05-23&timeZone=UTC'), {
          headers: { ...jsonHeaders },
        })
      )
    ).map((g) => g.id)
    const lagosMay22 = collectMatchesGames(
      await readJson(
        await fetch(
          apiUrl(
            `/api/v1/leagues?gameDate=2026-05-22&timeZone=${encodeURIComponent(LAGOS)}`
          ),
          { headers: { ...jsonHeaders } }
        )
      )
    ).map((g) => g.id)

    assert.notInclude(utcMay23, game.id)
    assert.notInclude(lagosMay22, game.id)
  })

  test('GET /api/v1/leagues returns 400 for invalid timeZone', async ({ assert }) => {
    const res = await fetch(apiUrl('/api/v1/leagues?gameDate=2026-05-23&timeZone=Not/A/Zone'), {
      headers: { ...jsonHeaders },
    })

    assert.equal(res.status, 400)
    const body = await readJson(res)
    assert.include(body.message, 'Invalid timeZone')
  })

  test('GET /api/v1/leagues returns 400 for invalid gameDate', async ({ assert }) => {
    const res = await fetch(
      apiUrl(`/api/v1/leagues?gameDate=not-a-date&timeZone=${encodeURIComponent(LAGOS)}`),
      { headers: { ...jsonHeaders } }
    )

    assert.equal(res.status, 400)
    const body = await readJson(res)
    assert.include(body.message, 'Invalid gameDate')
  })
})
