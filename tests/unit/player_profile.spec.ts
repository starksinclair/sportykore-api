import type { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Country from '#models/country'
import Player from '#models/player'
import PlayerHighlight from '#models/player_highlight'
import User from '#models/user'
import FileService from '#services/file_service'
import PlayerProfileService from '#services/player_profile_service'
import PlayerTransformer from '#transformers/player_transformer'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

function makeService() {
  return new PlayerProfileService(new FileService())
}

async function makeUser(email: string) {
  return User.create({ email, password: 'password1', fullName: 'Profile Tester' })
}

test.group('Player profile service', (group) => {
  withFreshDatabaseAndCountries(group)

  test('resolveOwn 404s before a profile exists and resolves after creation', async ({
    assert,
  }) => {
    const service = makeService()
    const user = await makeUser('resolve@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    await assert.rejects(() => service.resolveOwn(user.id))
    try {
      await service.resolveOwn(user.id)
    } catch (error) {
      assert.equal((error as Exception).status, 404)
    }

    await service.createOwn(user.id, { name: 'Resolver', countryId: country.id })
    const resolved = await service.resolveOwn(user.id)

    assert.equal(resolved.player.name, 'Resolver')
    assert.equal(resolved.highlightsCount, 0)
    assert.deepEqual(resolved.membership, { inLeague: false, inTeam: false })
  })

  test('completeness is a weighted checklist with missing field keys', async ({ assert }) => {
    const service = makeService()
    const user = await makeUser('completeness@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    await service.createOwn(user.id, { name: 'Half Done', countryId: country.id })
    const empty = await service.resolveOwn(user.id)
    assert.equal(empty.completeness, 0)
    assert.sameMembers(empty.missingFields, [
      'photo',
      'bio',
      'primaryPosition',
      'preferredFoot',
      'dateOfBirth',
      'city',
      'highlights',
    ])

    await service.updateOwn(user.id, {
      bio: 'Winger with pace',
      primaryPosition: 'attack',
      preferredFoot: 'left',
      dateOfBirth: DateTime.now().minus({ years: 21 }),
      city: 'Lagos',
    })
    const partial = await service.resolveOwn(user.id)
    assert.equal(partial.completeness, 60)
    assert.sameMembers(partial.missingFields, ['photo', 'highlights'])

    const player = await service.findOwnOrFail(user.id)
    player.avatarUrl = 'https://cdn.example.com/photo.jpg'
    await player.save()
    await PlayerHighlight.create({ playerId: player.id, videoId: 'dQw4w9WgXcQ', sortOrder: 0 })

    const full = await service.resolveOwn(user.id)
    assert.equal(full.completeness, 100)
    assert.deepEqual(full.missingFields, [])
  })

  test('a second profile for the same user is rejected with 409', async ({ assert }) => {
    const service = makeService()
    const user = await makeUser('duplicate@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    await service.createOwn(user.id, { name: 'First', countryId: country.id })

    try {
      await service.createOwn(user.id, { name: 'Second', countryId: country.id })
      assert.fail('expected 409')
    } catch (error) {
      assert.equal((error as Exception).status, 409)
    }
  })

  test('implausible dates of birth are rejected')
    .with([
      { label: 'future', dateOfBirth: DateTime.now().plus({ years: 1 }) },
      { label: 'too young', dateOfBirth: DateTime.now().minus({ years: 3 }) },
      { label: 'too old', dateOfBirth: DateTime.now().minus({ years: 90 }) },
    ])
    .run(async ({ assert }, row) => {
      const service = makeService()
      const user = await makeUser(`dob-${row.label.replace(/\s/g, '')}@test.com`)
      const country = await Country.findByOrFail('code', 'ng')

      try {
        await service.createOwn(user.id, {
          name: 'DOB Tester',
          countryId: country.id,
          dateOfBirth: row.dateOfBirth,
        })
        assert.fail('expected 422')
      } catch (error) {
        assert.equal((error as Exception).status, 422)
      }
    })

  test('transformer exposes computed age but never date_of_birth', async ({ assert }) => {
    const service = makeService()
    const user = await makeUser('age@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    const player = await service.createOwn(user.id, {
      name: 'Age Tester',
      countryId: country.id,
      dateOfBirth: DateTime.now().minus({ years: 21, months: 3 }),
    })

    const profile = new PlayerTransformer(player).profile() as Record<string, unknown>
    assert.equal(profile.age, 21)

    for (const variant of [
      new PlayerTransformer(player).toObject(),
      new PlayerTransformer(player).withStats(),
      new PlayerTransformer(player).withCountry(),
      profile,
    ]) {
      const text = JSON.stringify(variant)
      assert.notInclude(text, 'dateOfBirth')
      assert.notInclude(text, 'date_of_birth')
    }
  })

  test('a private player serializes to a minimal stub on every transformer variant', async ({
    assert,
  }) => {
    const user = await makeUser('private@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    const player = await Player.create({
      userId: user.id,
      countryId: country.id,
      name: 'Private Player',
      bio: 'SENTINEL_BIO',
      avatarUrl: 'https://cdn.example.com/SENTINEL_PHOTO.jpg',
      primaryPosition: 'attack',
      city: 'SENTINEL_CITY',
      socialHandle: 'SENTINEL_HANDLE',
      dateOfBirth: DateTime.now().minus({ years: 20 }),
      visibility: 'private',
    })

    const stub = { id: player.id, name: 'Private Player', visibility: 'private' }
    assert.deepEqual(new PlayerTransformer(player).toObject(), stub)
    assert.deepEqual(new PlayerTransformer(player).withStats(), stub)
    assert.deepEqual(new PlayerTransformer(player).withCountry(), stub)
    assert.deepEqual(new PlayerTransformer(player).profile(), stub)
  })
})
