import Country from '#models/country'
import League from '#models/league'
import Season from '#models/season'
import User from '#models/user'
import SeasonsController from '#controllers/seasons_controller'
import { createSeasonValidator, updateSeasonValidator } from '#validators/season'
import type { HttpContext } from '@adonisjs/core/http'
import { test } from '@japa/runner'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

function mockStoreContext(body: Record<string, unknown>): HttpContext {
  return {
    request: {
      validateUsing: async (validator: typeof createSeasonValidator) => validator.validate(body),
    },
    response: {
      created(payload: unknown) {
        return { __status: 201 as const, __response: payload as Season }
      },
    },
  } as unknown as HttpContext
}

function mockUpdateContext(
  leagueId: number,
  seasonId: number,
  body: Record<string, unknown>
): HttpContext {
  return {
    params: { leagueId: String(leagueId), seasonId: String(seasonId) },
    request: {
      validateUsing: async (validator: typeof updateSeasonValidator) => validator.validate(body),
    },
    response: {
      ok(payload: unknown) {
        return { status: 200, body: payload }
      },
    },
  } as unknown as HttpContext
}

async function createOwnerLeague() {
  const owner = await User.create({
    email: `season-owner-${Date.now()}@kpakore.test`,
    password: 'password1',
    fullName: 'Season Owner',
  })
  const country = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    name: 'Season Test League',
    userId: owner.id,
    countryId: country.id,
  })
  return { owner, league }
}

test.group('SeasonsController store', (group) => {
  withFreshDatabaseAndCountries(group)

  test('creating active season completes other active seasons in the league', async ({ assert }) => {
    const { league } = await createOwnerLeague()
    const activeSeason = await Season.create({
      leagueId: league.id,
      name: '2025',
      status: 'active',
    })
    const controller = new SeasonsController()

    const result = await controller.store(
      mockStoreContext({
        leagueId: league.id,
        name: '2026',
        status: 'active',
      })
    )

    assert.equal(result.__status, 201)
    assert.equal(result.__response.name, '2026')
    assert.equal(result.__response.status, 'active')

    await activeSeason.refresh()
    assert.equal(activeSeason.status, 'completed')
  })

  test('creating inactive season leaves other active seasons unchanged', async ({ assert }) => {
    const { league } = await createOwnerLeague()
    const activeSeason = await Season.create({
      leagueId: league.id,
      name: '2025',
      status: 'active',
    })
    const controller = new SeasonsController()

    const result = await controller.store(
      mockStoreContext({
        leagueId: league.id,
        name: '2026',
        status: 'inactive',
      })
    )

    assert.equal(result.__status, 201)
    assert.equal(result.__response.status, 'inactive')

    await activeSeason.refresh()
    assert.equal(activeSeason.status, 'active')
  })
})

test.group('SeasonsController update', (group) => {
  withFreshDatabaseAndCountries(group)

  test('updates season name', async ({ assert }) => {
    const { league } = await createOwnerLeague()
    const season = await Season.create({
      leagueId: league.id,
      name: '2025',
      status: 'inactive',
    })
    const controller = new SeasonsController()

    const result = await controller.update(
      mockUpdateContext(league.id, season.id, { name: '2026' })
    )

    assert.deepEqual(result, {
      status: 200,
      body: { message: 'Season updated successfully' },
    })

    await season.refresh()
    assert.equal(season.name, '2026')
    assert.equal(season.status, 'inactive')
  })

  test('activating one season completes other active seasons in the league', async ({ assert }) => {
    const { league } = await createOwnerLeague()
    const activeSeason = await Season.create({
      leagueId: league.id,
      name: '2025',
      status: 'active',
    })
    const nextSeason = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'inactive',
    })
    const controller = new SeasonsController()

    await controller.update(mockUpdateContext(league.id, nextSeason.id, { status: 'active' }))

    await activeSeason.refresh()
    await nextSeason.refresh()
    assert.equal(activeSeason.status, 'completed')
    assert.equal(nextSeason.status, 'active')
  })

  test('returns 404 when season id does not exist in league', async ({ assert }) => {
    const { league } = await createOwnerLeague()
    const controller = new SeasonsController()

    try {
      await controller.update(mockUpdateContext(league.id, 999_999, { name: 'Ghost Season' }))
      assert.fail('expected update to throw')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
  })

  test('returns 404 when season belongs to another league', async ({ assert }) => {
    const { league } = await createOwnerLeague()
    const otherLeague = await League.create({
      name: 'Other League',
      userId: league.userId,
      countryId: league.countryId,
    })
    const otherSeason = await Season.create({
      leagueId: otherLeague.id,
      name: 'Other Season',
      status: 'inactive',
    })
    const controller = new SeasonsController()

    try {
      await controller.update(
        mockUpdateContext(league.id, otherSeason.id, { name: 'Should Fail' })
      )
      assert.fail('expected update to throw')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
  })
})
