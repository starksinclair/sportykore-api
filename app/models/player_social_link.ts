import { BaseModel, beforeSave, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'

import CoachProfile from '#models/coach_profile'
import Player from '#models/player'
import type { PlayerSocialPlatform } from '#types/player'

export default class PlayerSocialLink extends BaseModel {
  static table = 'player_social_links'

  /**
   * Every row belongs to exactly one owner. Postgres also enforces this
   * with a DB-level CHECK constraint, but that constraint isn't supported
   * under sqlite (the environment tests run against), so this hook is the
   * only thing that actually exercises the invariant in tests/dev.
   */
  @beforeSave()
  static async enforceSingleOwner(link: PlayerSocialLink) {
    const hasPlayer = link.playerId !== null && link.playerId !== undefined
    const hasCoach = link.coachProfileId !== null && link.coachProfileId !== undefined
    if (hasPlayer === hasCoach) {
      throw new Exception('A social link must belong to exactly one owner.', { status: 500 })
    }
  }

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare playerId: number | null

  @column()
  declare coachProfileId: number | null

  @column()
  declare platform: PlayerSocialPlatform

  @column()
  declare url: string

  @column()
  declare handle: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Player)
  declare player: BelongsTo<typeof Player>

  @belongsTo(() => CoachProfile)
  declare coachProfile: BelongsTo<typeof CoachProfile>
}
