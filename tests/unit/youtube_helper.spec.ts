import { test } from '@japa/runner'

import { parseYouTubeVideoId, youTubeThumbnailUrl } from '#helpers/youtube'

const VIDEO_ID = 'dQw4w9WgXcQ'

test.group('YouTube URL parsing', () => {
  test('resolves every supported URL form to the same video ID')
    .with([
      `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      `https://youtube.com/watch?v=${VIDEO_ID}`,
      `http://youtube.com/watch?v=${VIDEO_ID}`,
      `youtube.com/watch?v=${VIDEO_ID}`,
      `https://m.youtube.com/watch?v=${VIDEO_ID}`,
      `https://www.youtube.com/watch?v=${VIDEO_ID}&t=42s&list=PLx`,
      `https://youtu.be/${VIDEO_ID}`,
      `youtu.be/${VIDEO_ID}?si=abcdef`,
      `https://www.youtube.com/shorts/${VIDEO_ID}`,
      `youtube.com/shorts/${VIDEO_ID}?feature=share`,
      `https://www.youtube.com/embed/${VIDEO_ID}`,
      `https://www.youtube.com/live/${VIDEO_ID}`,
    ])
    .run(({ assert }, url) => {
      assert.equal(parseYouTubeVideoId(url), VIDEO_ID)
    })

  test('rejects non-YouTube and malformed input')
    .with([
      'https://vimeo.com/123456789',
      'https://example.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.evil.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch',
      'https://www.youtube.com/watch?v=too-short',
      `https://www.youtube.com/playlist?list=${VIDEO_ID}`,
      'not a url at all',
      '',
    ])
    .run(({ assert }, url) => {
      assert.isNull(parseYouTubeVideoId(url))
    })

  test('thumbnail URL is derived from the stored ID', ({ assert }) => {
    assert.equal(
      youTubeThumbnailUrl(VIDEO_ID),
      `https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`
    )
  })
})
