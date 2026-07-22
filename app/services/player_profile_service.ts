import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import string from '@adonisjs/core/helpers/string'
import { DateTime } from 'luxon'

import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import PlayerHighlight from '#models/player_highlight'
import FileService from '#services/file_service'
import { MAX_PLAYER_AGE, MIN_PLAYER_AGE } from '#types/player'
import type { PlayerPosition, PreferredFoot } from '#types/player'

export type PlayerProfileInput = {
  name?: string
  countryId?: number
  bio?: string | null
  primaryPosition?: PlayerPosition | null
  secondaryPosition?: PlayerPosition | null
  preferredFoot?: PreferredFoot | null
  heightCm?: number | null
  dateOfBirth?: DateTime | null
  city?: string | null
  state?: string | null
  nationality?: string | null
  socialHandle?: string | null
}

export type ProfileCompleteness = {
  completeness: number
  missingFields: string[]
}

export type ResolvedProfile = {
  player: Player
  completeness: number
  missingFields: string[]
  highlightsCount: number
  membership: {
    inLeague: boolean
    inTeam: boolean
  }
}

/**
 * Weighted checklist behind the profile-completeness nudge. The rule lives
 * here (server-side) so clients never duplicate it. Weights sum to 100.
 */
const COMPLETENESS_WEIGHTS: Array<{
  key: string
  weight: number
  isFilled: (player: Player, highlightsCount: number) => boolean
}> = [
  { key: 'photo', weight: 20, isFilled: (player) => !!player.avatarUrl },
  { key: 'bio', weight: 10, isFilled: (player) => !!player.bio?.trim() },
  { key: 'primaryPosition', weight: 15, isFilled: (player) => !!player.primaryPosition },
  { key: 'preferredFoot', weight: 10, isFilled: (player) => !!player.preferredFoot },
  { key: 'dateOfBirth', weight: 15, isFilled: (player) => !!player.dateOfBirth },
  { key: 'city', weight: 10, isFilled: (player) => !!player.city?.trim() },
  { key: 'highlights', weight: 20, isFilled: (_, highlightsCount) => highlightsCount > 0 },
]

@inject()
export default class PlayerProfileService {
  constructor(private fileService: FileService) {}

  /** The player record owned by the authenticated user, or null. */
  async findOwn(userId: number): Promise<Player | null> {
    return Player.query().where('user_id', userId).first()
  }

  /** Same as {@link findOwn} but 404s — the "no profile" signal for the app CTA. */
  async findOwnOrFail(userId: number): Promise<Player> {
    const player = await this.findOwn(userId)
    if (!player) {
      throw new Exception('You do not have a player profile yet', { status: 404 })
    }
    return player
  }

  async resolveOwn(userId: number): Promise<ResolvedProfile> {
    const player = await this.findOwnOrFail(userId)

    const [highlightsCount, memberships] = await Promise.all([
      PlayerHighlight.query().where('player_id', player.id).count('* as total'),
      LeaguePlayer.query().where('player_id', player.id).where('status', 'active'),
    ])

    const count = Number(highlightsCount[0]?.$extras.total ?? 0)

    return {
      player,
      ...this.completenessFor(player, count),
      highlightsCount: count,
      membership: {
        inLeague: memberships.length > 0,
        inTeam: memberships.some((membership) => membership.teamId !== null),
      },
    }
  }

  async createOwn(userId: number, input: PlayerProfileInput): Promise<Player> {
    const existing = await this.findOwn(userId)
    if (existing) {
      throw new Exception('You already have a player profile', { status: 409 })
    }
    if (!input.name?.trim()) {
      throw new Exception('name is required', { status: 422 })
    }
    if (!input.countryId) {
      throw new Exception('countryId is required', { status: 422 })
    }
    this.assertPlausibleDateOfBirth(input.dateOfBirth)

    return Player.create({
      userId,
      addedBy: userId,
      name: input.name.trim(),
      countryId: input.countryId,
      bio: input.bio ?? null,
      primaryPosition: input.primaryPosition ?? null,
      secondaryPosition: input.secondaryPosition ?? null,
      preferredFoot: input.preferredFoot ?? null,
      heightCm: input.heightCm ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      nationality: input.nationality ?? null,
      socialHandle: input.socialHandle ?? null,
      visibility: 'active',
    })
  }

  async updateOwn(userId: number, input: PlayerProfileInput): Promise<Player> {
    const player = await this.findOwnOrFail(userId)
    this.assertPlausibleDateOfBirth(input.dateOfBirth)

    if (input.name !== undefined) player.name = input.name.trim()
    if (input.countryId !== undefined) player.countryId = input.countryId
    if (input.bio !== undefined) player.bio = input.bio
    if (input.primaryPosition !== undefined) player.primaryPosition = input.primaryPosition
    if (input.secondaryPosition !== undefined) player.secondaryPosition = input.secondaryPosition
    if (input.preferredFoot !== undefined) player.preferredFoot = input.preferredFoot
    if (input.heightCm !== undefined) player.heightCm = input.heightCm
    if (input.dateOfBirth !== undefined) player.dateOfBirth = input.dateOfBirth
    if (input.city !== undefined) player.city = input.city
    if (input.state !== undefined) player.state = input.state
    if (input.nationality !== undefined) player.nationality = input.nationality
    if (input.socialHandle !== undefined) player.socialHandle = input.socialHandle

    await player.save()
    return player
  }

  /** Upload/replace the profile photo via the existing S3 pipeline (players/ prefix). */
  async uploadPhoto(userId: number, photo: MultipartFile): Promise<Player> {
    const player = await this.findOwnOrFail(userId)
    const key = `players/${string.uuid()}.${photo.extname}`
    player.avatarUrl = await this.fileService.upload(photo, key)
    await player.save()
    return player
  }

  completenessFor(player: Player, highlightsCount: number): ProfileCompleteness {
    let score = 0
    const missingFields: string[] = []

    for (const item of COMPLETENESS_WEIGHTS) {
      if (item.isFilled(player, highlightsCount)) {
        score += item.weight
      } else {
        missingFields.push(item.key)
      }
    }

    return { completeness: score, missingFields }
  }

  private assertPlausibleDateOfBirth(dateOfBirth: DateTime | null | undefined) {
    if (!dateOfBirth) {
      return
    }
    const age = Math.floor(Math.abs(dateOfBirth.diffNow('years').years))
    if (dateOfBirth > DateTime.now() || age < MIN_PLAYER_AGE || age > MAX_PLAYER_AGE) {
      throw new Exception(
        `dateOfBirth must be in the past and imply an age between ${MIN_PLAYER_AGE} and ${MAX_PLAYER_AGE}`,
        { status: 422 }
      )
    }
  }
}
