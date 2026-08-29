import { Exception } from '@adonisjs/core/exceptions'

import { PLAYER_SOCIAL_PLATFORMS } from '#types/player'
import type { PlayerSocialPlatform } from '#types/player'

type NormalizedSocialLink = {
  platform: PlayerSocialPlatform
  url: string
  handle: string | null
}

const PLATFORM_HOSTS: Record<Exclude<PlayerSocialPlatform, 'website'>, readonly string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'],
}

const RESERVED_PATHS = new Set([
  '',
  'home',
  'explore',
  'reels',
  'shorts',
  'watch',
  'embed',
  'live',
  'playlist',
  'hashtag',
  'search',
])

export function normalizePlayerSocialLinks(
  links: Array<{ platform: PlayerSocialPlatform; url: string }> | undefined
): NormalizedSocialLink[] | undefined {
  if (links === undefined) {
    return undefined
  }

  const seen = new Set<PlayerSocialPlatform>()
  const normalized: NormalizedSocialLink[] = []

  for (const link of links) {
    if (seen.has(link.platform)) {
      throw new Exception('Only one link is allowed per social platform.', { status: 422 })
    }
    seen.add(link.platform)
    normalized.push(normalizePlayerSocialLink(link.platform, link.url))
  }

  return normalized
}

function normalizePlayerSocialLink(
  platform: PlayerSocialPlatform,
  input: string
): NormalizedSocialLink {
  if (!PLAYER_SOCIAL_PLATFORMS.includes(platform)) {
    throw new Exception('Choose a supported social platform.', { status: 422 })
  }

  if (platform === 'website') {
    return normalizeWebsiteLink(input)
  }

  const raw = input.trim()
  if (!raw) {
    throw new Exception('Enter a social link or handle.', { status: 422 })
  }

  if (/^https?:\/\//i.test(raw) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) {
    return normalizePlatformUrl(platform, raw)
  }

  return normalizePlatformHandle(platform, raw)
}

function normalizeWebsiteLink(input: string): NormalizedSocialLink {
  const raw = input.trim()
  if (!raw) {
    throw new Exception('Enter a website URL.', { status: 422 })
  }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new Exception('Enter a valid website URL.', { status: 422 })
  }

  if (url.protocol !== 'https:') {
    throw new Exception('Website links must start with https://.', { status: 422 })
  }

  return {
    platform: 'website',
    url: url.toString(),
    handle: url.hostname.replace(/^www\./i, ''),
  }
}

function normalizePlatformUrl(platform: Exclude<PlayerSocialPlatform, 'website'>, input: string) {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    throw new Exception(`Enter a valid ${platformLabel(platform)} link.`, { status: 422 })
  }

  const host = url.hostname.toLowerCase()
  const allowedHosts = PLATFORM_HOSTS[platform]
  if (!allowedHosts.includes(host)) {
    throw new Exception(`Enter a valid ${platformLabel(platform)} link.`, { status: 422 })
  }

  if (platform === 'youtube') {
    return normalizeYouTubeProfileUrl(url)
  }

  const handle = firstPathSegment(url)
  if (!handle || RESERVED_PATHS.has(handle.toLowerCase())) {
    throw new Exception(`Enter a valid ${platformLabel(platform)} profile link.`, { status: 422 })
  }

  const canonicalUrl = canonicalProfileUrl(platform, cleanHandle(platform, handle))
  return {
    platform,
    url: canonicalUrl,
    handle: cleanHandle(platform, handle),
  }
}

function normalizePlatformHandle(
  platform: Exclude<PlayerSocialPlatform, 'website'>,
  input: string
) {
  if (platform === 'youtube' && input.includes('/')) {
    return normalizePlatformUrl('youtube', input)
  }

  const handle = cleanHandle(platform, input)
  if (!handle || RESERVED_PATHS.has(handle.toLowerCase())) {
    throw new Exception(`Enter a valid ${platformLabel(platform)} handle.`, { status: 422 })
  }

  return {
    platform,
    url: canonicalProfileUrl(platform, handle),
    handle: platform === 'youtube' ? `@${handle}` : handle,
  }
}

function normalizeYouTubeProfileUrl(url: URL): NormalizedSocialLink {
  const segments = url.pathname.split('/').filter(Boolean)
  const first = segments[0]?.toLowerCase()

  if (
    url.hostname.toLowerCase().includes('youtu.be') ||
    first === 'watch' ||
    first === 'embed' ||
    first === 'shorts'
  ) {
    throw new Exception('Use Highlights for YouTube video clips.', { status: 422 })
  }

  if (!segments[0]) {
    throw new Exception('Enter a valid YouTube channel link.', { status: 422 })
  }

  if (segments[0].startsWith('@')) {
    const handle = cleanHandle('youtube', segments[0])
    return { platform: 'youtube', url: `https://www.youtube.com/@${handle}`, handle: `@${handle}` }
  }

  if (['channel', 'c', 'user'].includes(first ?? '') && segments[1]) {
    const handle = cleanHandle('youtube', segments[1])
    return {
      platform: 'youtube',
      url: `https://www.youtube.com/${segments[0]}/${encodeURIComponent(handle)}`,
      handle,
    }
  }

  throw new Exception('Enter a valid YouTube channel link.', { status: 422 })
}

function firstPathSegment(url: URL): string | null {
  return url.pathname.split('/').filter(Boolean)[0] ?? null
}

function cleanHandle(platform: Exclude<PlayerSocialPlatform, 'website'>, input: string): string {
  let handle = input.trim().replace(/^@+/, '').replace(/\/+$/g, '')
  if (platform === 'youtube') {
    handle = handle.replace(/^@+/, '')
  }
  return handle.slice(0, 160)
}

function canonicalProfileUrl(
  platform: Exclude<PlayerSocialPlatform, 'website'>,
  handle: string
): string {
  const encoded = encodeURIComponent(handle)
  if (platform === 'instagram') return `https://www.instagram.com/${encoded}`
  if (platform === 'tiktok') return `https://www.tiktok.com/@${encoded}`
  if (platform === 'youtube') return `https://www.youtube.com/@${encoded}`
  if (platform === 'x') return `https://x.com/${encoded}`
  return `https://www.facebook.com/${encoded}`
}

function platformLabel(platform: PlayerSocialPlatform): string {
  if (platform === 'x') return 'X'
  return `${platform[0]?.toUpperCase() ?? ''}${platform.slice(1)}`
}
