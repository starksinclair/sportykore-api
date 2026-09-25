import type { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'

import Country from '#models/country'
import League from '#models/league'
import PlayerSocialLink from '#models/player_social_link'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import User from '#models/user'
import CoachProfileService from '#services/coach_profile_service'
import FileService from '#services/file_service'
import CoachProfileTransformer from '#transformers/coach_profile_transformer'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

function makeService() {
  return new CoachProfileService(new FileService())
}

async function makeUser(email: string) {
  return User.create({ email, password: 'password1', fullName: 'Coach Tester' })
}

test.group('Coach profile service', (group) => {
  withFreshDatabaseAndCountries(group)

  test('resolveOwn 404s before a coach profile exists and resolves after creation', async ({
    assert,
  }) => {
    const service = makeService()
    const user = await makeUser('coach-resolve@test.com')

    try {
      await service.resolveOwn(user.id)
      assert.fail('expected 404')
    } catch (error) {
      assert.equal((error as Exception).status, 404)
    }

    await service.createOwn(user.id, { displayName: 'Coach Resolver' })
    const profile = await service.resolveOwn(user.id)

    assert.equal(profile.displayName, 'Coach Resolver')
    assert.equal(profile.availability, 'open')
    assert.equal(profile.visibility, 'public')
  })

  test('creates and replaces normalized social links on the existing social-links table', async ({
    assert,
  }) => {
    const service = makeService()
    const user = await makeUser('coach-social@test.com')
    const country = await Country.findByOrFail('code', 'ng')

    const created = await service.createOwn(user.id, {
      displayName: 'Coach Ade',
      countryId: country.id,
      bio: 'Development coach',
      socialLinks: [
        { platform: 'instagram', url: '@coachade' },
        { platform: 'youtube', url: 'https://www.youtube.com/@coachade' },
      ],
    })

    assert.equal(created.country.name, 'Nigeria')
    assert.deepEqual(
      created.socialLinks.map((link) => ({
        platform: link.platform,
        url: link.url,
        handle: link.handle,
      })),
      [
        {
          platform: 'instagram',
          url: 'https://www.instagram.com/coachade',
          handle: 'coachade',
        },
        {
          platform: 'youtube',
          url: 'https://www.youtube.com/@coachade',
          handle: '@coachade',
        },
      ]
    )

    const updated = await service.updateOwn(user.id, {
      socialLinks: [{ platform: 'website', url: 'https://coach.example.com' }],
    })
    assert.deepEqual(
      updated.socialLinks.map((link) => link.platform),
      ['website']
    )

    const rows = await PlayerSocialLink.query()
    assert.lengthOf(rows, 1)
    assert.isNull(rows[0]!.playerId)
    assert.equal(rows[0]!.coachProfileId, created.id)
  })

  test('rejects YouTube video links for coach social links', async ({ assert }) => {
    const service = makeService()
    const user = await makeUser('coach-youtube-video@test.com')

    try {
      await service.createOwn(user.id, {
        displayName: 'Video Link Coach',
        socialLinks: [{ platform: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' }],
      })
      assert.fail('expected 422')
    } catch (error) {
      assert.equal((error as Exception).status, 422)
      assert.equal(
        (error as Exception).message,
        'Link to your YouTube channel, not a specific video.'
      )
    }
  })

  test('loads league history from team admin assignments', async ({ assert }) => {
    const service = makeService()
    const user = await makeUser('coach-history@test.com')
    const owner = await makeUser('coach-history-owner@test.com')
    const country = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      countryId: country.id,
      name: 'Coach History League',
      description: 'League used to test coach history',
      gender: 'mixed',
    })
    const team = await Team.create({
      leagueId: league.id,
      addedBy: owner.id,
      name: 'History United',
    })

    await service.createOwn(user.id, { displayName: 'History Coach' })
    await TeamAdmin.create({
      leagueId: league.id,
      teamId: team.id,
      userId: user.id,
      assignedBy: owner.id,
    })

    const profile = await service.resolveOwn(user.id)
    const serialized = new CoachProfileTransformer(profile).ownProfile() as {
      leagues: Array<{
        active: boolean
        league: { id: number; name: string }
        team: { id: number; name: string }
      }>
    }

    assert.lengthOf(serialized.leagues, 1)
    assert.equal(serialized.leagues[0]!.active, true)
    assert.equal(serialized.leagues[0]!.league.id, league.id)
    assert.equal(serialized.leagues[0]!.league.name, 'Coach History League')
    assert.equal(serialized.leagues[0]!.team.id, team.id)
    assert.equal(serialized.leagues[0]!.team.name, 'History United')
  })

  test('private coach profiles serialize to a minimal public stub', async ({ assert }) => {
    const service = makeService()
    const user = await makeUser('coach-private@test.com')

    const profile = await service.createOwn(user.id, {
      displayName: 'Private Coach',
      visibility: 'private',
      bio: 'Do not show this publicly',
      socialLinks: [{ platform: 'x', url: '@privatecoach' }],
    })

    const serialized = new CoachProfileTransformer(profile).toObject()
    assert.deepEqual(serialized, {
      id: profile.id,
      displayName: 'Private Coach',
      visibility: 'private',
    })
  })
})
