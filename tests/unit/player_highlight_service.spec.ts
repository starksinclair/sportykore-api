import type { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'

import Country from '#models/country'
import User from '#models/user'
import FileService from '#services/file_service'
import PlayerHighlightService from '#services/player_highlight_service'
import PlayerProfileService from '#services/player_profile_service'
import { MAX_HIGHLIGHTS_PER_PLAYER } from '#types/player'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

function makeServices() {
  const profileService = new PlayerProfileService(new FileService())
  return { profileService, highlightService: new PlayerHighlightService(profileService) }
}

async function makePlayerOwner(email: string) {
  const { profileService } = makeServices()
  const user = await User.create({ email, password: 'password1', fullName: 'Highlight Tester' })
  const country = await Country.findByOrFail('code', 'ng')
  const player = await profileService.createOwn(user.id, { name: email, countryId: country.id })
  return { user, player }
}

const WATCH_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const VIDEO_ID = 'dQw4w9WgXcQ'

test.group('PlayerHighlightService', (group) => {
  withFreshDatabaseAndCountries(group)

  test('add rejects a non-YouTube URL', async ({ assert }) => {
    const { highlightService } = makeServices()
    const { user } = await makePlayerOwner('nonyoutube@test.com')

    try {
      await highlightService.add(user.id, { url: 'https://vimeo.com/12345' })
      assert.fail('expected 422')
    } catch (error) {
      assert.equal((error as Exception).status, 422)
    }
  })

  test('duplicate video on the same player is rejected', async ({ assert }) => {
    const { highlightService } = makeServices()
    const { user } = await makePlayerOwner('duplicate-video@test.com')

    await highlightService.add(user.id, { url: WATCH_URL })
    try {
      await highlightService.add(user.id, { url: `https://youtu.be/${VIDEO_ID}?si=x` })
      assert.fail('expected 409')
    } catch (error) {
      assert.equal((error as Exception).status, 409)
    }
  })

  test('the 11th highlight is rejected', async ({ assert }) => {
    const { highlightService } = makeServices()
    const { user } = await makePlayerOwner('cap@test.com')

    for (let i = 0; i < MAX_HIGHLIGHTS_PER_PLAYER; i++) {
      await highlightService.add(user.id, { url: `https://youtu.be/${'a'.repeat(10)}${i}` })
    }

    try {
      await highlightService.add(user.id, { url: `https://youtu.be/${'b'.repeat(11)}` })
      assert.fail('expected 422')
    } catch (error) {
      assert.equal((error as Exception).status, 422)
      assert.include((error as Exception).message, `${MAX_HIGHLIGHTS_PER_PLAYER}`)
    }
  })

  test('reorder rewrites sort_order and survives a refetch', async ({ assert }) => {
    const { highlightService } = makeServices()
    const { user } = await makePlayerOwner('reorder@test.com')

    const a = await highlightService.add(user.id, { url: 'https://youtu.be/aaaaaaaaaaa' })
    const b = await highlightService.add(user.id, { url: 'https://youtu.be/bbbbbbbbbbb' })
    const c = await highlightService.add(user.id, { url: 'https://youtu.be/ccccccccccc' })

    await highlightService.reorder(user.id, [c.id, a.id, b.id])

    const refetched = await highlightService.listOwn(user.id)
    assert.deepEqual(
      refetched.map((h) => h.id),
      [c.id, a.id, b.id]
    )
    assert.deepEqual(
      refetched.map((h) => h.sortOrder),
      [0, 1, 2]
    )
  })

  test('reorder rejects a payload that does not cover every highlight exactly once', async ({
    assert,
  }) => {
    const { highlightService } = makeServices()
    const { user } = await makePlayerOwner('reorder-invalid@test.com')

    const a = await highlightService.add(user.id, { url: 'https://youtu.be/aaaaaaaaaaa' })
    await highlightService.add(user.id, { url: 'https://youtu.be/bbbbbbbbbbb' })

    try {
      await highlightService.reorder(user.id, [a.id])
      assert.fail('expected 422')
    } catch (error) {
      assert.equal((error as Exception).status, 422)
    }
  })

  test("a non-owner cannot add, edit, or delete another player's highlights", async ({
    assert,
  }) => {
    const { highlightService } = makeServices()
    const { user: owner } = await makePlayerOwner('owner@test.com')
    const { user: intruder } = await makePlayerOwner('intruder@test.com')

    const highlight = await highlightService.add(owner.id, { url: WATCH_URL })

    try {
      await highlightService.updateTitle(intruder.id, highlight.id, 'Hijacked')
      assert.fail('expected 404')
    } catch (error) {
      assert.equal((error as Exception).status, 404)
    }

    try {
      await highlightService.destroy(intruder.id, highlight.id)
      assert.fail('expected 404')
    } catch (error) {
      assert.equal((error as Exception).status, 404)
    }

    // Untouched by the intruder's attempts
    const stillOwned = await highlightService.listOwn(owner.id)
    assert.lengthOf(stillOwned, 1)
    assert.equal(stillOwned[0]!.title, null)
  })
})
