const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be'])

/**
 * Extracts the 11-character video ID from a pasted YouTube URL.
 * Supports watch?v=, youtu.be/, shorts/ and embed/ forms, with or without
 * www./scheme and extra query params. Returns null for anything else.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) {
    return null
  }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  let candidate: string | null = null

  if (SHORT_HOSTS.has(host)) {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (YOUTUBE_HOSTS.has(host)) {
    const segments = url.pathname.split('/').filter(Boolean)
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v')
    } else if (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') {
      candidate = segments[1] ?? null
    }
  } else {
    return null
  }

  if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) {
    return null
  }

  return candidate
}

/** Free thumbnail for a stored video ID — no YouTube Data API involved. */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}
