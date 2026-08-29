import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Player from '#models/player'
import type { PlayerSocialPlatform } from '#types/player'

export default class PlayerSocialLink extends BaseModel {
  static table = 'player_social_links'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare playerId: number

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
}
