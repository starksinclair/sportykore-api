import type { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'

import { normalizePlayerSocialLinks } from '#helpers/player_social_links'

test.group('Player social link normalization', () => {
  test('normalizes handles and profile URLs')
    .with([
      {
        platform: 'instagram' as const,
        url: '@ada.plays',
        expectedUrl: 'https://www.instagram.com/ada.plays',
        expectedHandle: 'ada.plays',
      },
      {
        platform: 'tiktok' as const,
        url: 'https://www.tiktok.com/@ada.plays',
        expectedUrl: 'https://www.tiktok.com/@ada.plays',
        expectedHandle: 'ada.plays',
      },
      {
        platform: 'x' as const,
        url: 'twitter.com/ada_plays',
        expectedUrl: 'https://x.com/ada_plays',
        expectedHandle: 'ada_plays',
      },
      {
        platform: 'facebook' as const,
        url: 'facebook.com/ada.plays',
        expectedUrl: 'https://www.facebook.com/ada.plays',
        expectedHandle: 'ada.plays',
      },
      {
        platform: 'youtube' as const,
        url: 'youtube.com/@adaplays',
        expectedUrl: 'https://www.youtube.com/@adaplays',
        expectedHandle: '@adaplays',
      },
      {
        platform: 'website' as const,
        url: 'https://adaplays.com',
        expectedUrl: 'https://adaplays.com/',
        expectedHandle: 'adaplays.com',
      },
    ])
    .run(({ assert }, row) => {
      const [link] = normalizePlayerSocialLinks([{ platform: row.platform, url: row.url }])!
      assert.equal(link?.url, row.expectedUrl)
      assert.equal(link?.handle, row.expectedHandle)
    })

  test('rejects duplicate platforms', ({ assert }) => {
    try {
      normalizePlayerSocialLinks([
        { platform: 'instagram', url: '@one' },
        { platform: 'instagram', url: '@two' },
      ])
      assert.fail('expected 422')
    } catch (error) {
      assert.equal((error as Exception).status, 422)
    }
  })

  test('rejects invalid hosts and YouTube video links')
    .with([
      { platform: 'instagram' as const, url: 'https://example.com/ada' },
      { platform: 'youtube' as const, url: 'https://youtu.be/dQw4w9WgXcQ' },
      { platform: 'youtube' as const, url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
      { platform: 'website' as const, url: 'http://example.com' },
    ])
    .run(({ assert }, row) => {
      try {
        normalizePlayerSocialLinks([row])
        assert.fail('expected 422')
      } catch (error) {
        assert.equal((error as Exception).status, 422)
      }
    })
})
