import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import { coachPhotoKey } from '#helpers/storage_paths'
import { normalizePlayerSocialLinks } from '#helpers/player_social_links'
import CoachProfile from '#models/coach_profile'
import PlayerSocialLink from '#models/player_social_link'
import TeamAdmin from '#models/team_admin'
import FileService from '#services/file_service'
import type { CoachAvailability, CoachLeagueHistoryItem, CoachVisibility } from '#types/coach'
import type { PlayerSocialPlatform } from '#types/player'

// Coach profiles have no Highlights feature, so the shared normalizer's
// default YouTube-video-link message (which points players at Highlights)
// would be a dead end here.
const COACH_YOUTUBE_LINK_OPTIONS = {
  youTubeVideoLinkMessage: 'Link to your YouTube channel, not a specific video.',
}

export type CoachProfileInput = {
  displayName?: string
  bio?: string | null
  experience?: string | null
  qualifications?: string | null
  philosophy?: string | null
  countryId?: number | null
  city?: string | null
  state?: string | null
  availability?: CoachAvailability
  visibility?: CoachVisibility
  socialLinks?: Array<{ platform: PlayerSocialPlatform; url: string }>
}

@inject()
export default class CoachProfileService {
  constructor(private fileService: FileService) {}

  async findOwn(userId: number): Promise<CoachProfile | null> {
    return CoachProfile.query().where('user_id', userId).first()
  }

  async findOwnOrFail(userId: number): Promise<CoachProfile> {
    const profile = await this.findOwn(userId)
    if (!profile) {
      throw new Exception('You do not have a coach profile yet', { status: 404 })
    }
    return profile
  }

  async resolveOwn(userId: number): Promise<CoachProfile> {
    const profile = await this.findOwnOrFail(userId)
    return this.loadProfileRelations(profile)
  }

  async findPublic(id: number): Promise<CoachProfile> {
    const profile = await CoachProfile.findOrFail(id)
    return this.loadProfileRelations(profile)
  }

  async createOwn(userId: number, input: CoachProfileInput): Promise<CoachProfile> {
    const existing = await this.findOwn(userId)
    if (existing) {
      throw new Exception('You already have a coach profile', { status: 409 })
    }
    if (!input.displayName?.trim()) {
      throw new Exception('displayName is required', { status: 422 })
    }

    const links = normalizePlayerSocialLinks(input.socialLinks, COACH_YOUTUBE_LINK_OPTIONS)

    let profile: CoachProfile
    try {
      profile = await CoachProfile.create({
        userId,
        displayName: input.displayName.trim(),
        bio: input.bio ?? null,
        experience: input.experience ?? null,
        qualifications: input.qualifications ?? null,
        philosophy: input.philosophy ?? null,
        countryId: input.countryId ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        availability: input.availability ?? 'open',
        visibility: input.visibility ?? 'public',
      })
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new Exception('You already have a coach profile', { status: 409 })
      }
      throw error
    }

    if (links) {
      await this.replaceSocialLinks(profile.id, links)
    }

    return this.loadProfileRelations(profile)
  }

  async updateOwn(userId: number, input: CoachProfileInput): Promise<CoachProfile> {
    const profile = await this.findOwnOrFail(userId)
    const links = normalizePlayerSocialLinks(input.socialLinks, COACH_YOUTUBE_LINK_OPTIONS)

    if (input.displayName !== undefined) profile.displayName = input.displayName.trim()
    if (input.bio !== undefined) profile.bio = input.bio
    if (input.experience !== undefined) profile.experience = input.experience
    if (input.qualifications !== undefined) profile.qualifications = input.qualifications
    if (input.philosophy !== undefined) profile.philosophy = input.philosophy
    if (input.countryId !== undefined) profile.countryId = input.countryId
    if (input.city !== undefined) profile.city = input.city
    if (input.state !== undefined) profile.state = input.state
    if (input.availability !== undefined) profile.availability = input.availability
    if (input.visibility !== undefined) profile.visibility = input.visibility

    await profile.save()
    if (links !== undefined) {
      await this.replaceSocialLinks(profile.id, links)
    }

    return this.loadProfileRelations(profile)
  }

  async uploadPhoto(userId: number, photo: MultipartFile): Promise<CoachProfile> {
    const profile = await this.findOwnOrFail(userId)
    profile.photoUrl = await this.fileService.upload(photo, coachPhotoKey(profile, photo.extname))
    await profile.save()
    return this.loadProfileRelations(profile)
  }

  private async replaceSocialLinks(
    coachProfileId: number,
    links: Array<{ platform: PlayerSocialPlatform; url: string; handle: string | null }>
  ) {
    await db.transaction(async (trx) => {
      await PlayerSocialLink.query({ client: trx })
        .where('coach_profile_id', coachProfileId)
        .delete()

      if (links.length === 0) {
        return
      }

      await PlayerSocialLink.createMany(
        links.map((link) => ({
          playerId: null,
          coachProfileId,
          platform: link.platform,
          url: link.url,
          handle: link.handle,
        })),
        { client: trx }
      )
    })
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }
    const message = 'message' in error ? String((error as { message: unknown }).message) : ''
    const code = 'code' in error ? String((error as { code: unknown }).code) : ''
    return (
      code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      code === '23505' ||
      /UNIQUE constraint failed/i.test(message) ||
      /duplicate key/i.test(message)
    )
  }

  private async loadProfileRelations(profile: CoachProfile): Promise<CoachProfile> {
    await profile.load('country')
    await profile.load('socialLinks', (socialLinksQuery) => {
      socialLinksQuery.orderBy('platform', 'asc')
    })
    profile.$extras.leagues = await this.coachLeagueHistory(profile.userId)
    return profile
  }

  private async coachLeagueHistory(userId: number): Promise<CoachLeagueHistoryItem[]> {
    const rows = await TeamAdmin.query()
      .where('user_id', userId)
      .preload('league')
      .preload('team')
      .orderBy('created_at', 'desc')

    return rows.map((row) => ({
      id: row.id,
      role: 'team_admin',
      active: !row.removedAt,
      assignedAt: row.createdAt?.toISO() ?? null,
      removedAt: row.removedAt?.toISO() ?? null,
      league: {
        id: row.league.id,
        name: row.league.name,
        logoUrl: row.league.logoUrl,
      },
      team: {
        id: row.team.id,
        name: row.team.name ?? 'Unnamed team',
        logoUrl: row.team.logoUrl,
      },
    }))
  }
}
