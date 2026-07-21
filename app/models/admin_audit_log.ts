import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import League from '#models/league'
import User from '#models/user'

export default class AdminAuditLog extends BaseModel {
  static table = 'admin_audit_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare leagueId: number

  @column()
  declare actorId: number | null

  @column()
  declare action: string

  @column()
  declare entityType: string

  @column()
  declare entityId: number | null

  @column()
  declare metadata: Record<string, unknown>

  @column()
  declare ipAddress: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => User, { foreignKey: 'actorId' })
  declare actor: BelongsTo<typeof User>
}
