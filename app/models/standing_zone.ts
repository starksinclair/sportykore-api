import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Stage from '#models/stage'
import StageGroup from '#models/stage_group'
import type { ZoneType } from '#types/standing'

export default class StandingZone extends BaseModel {
  static table = 'standing_zones'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare stageId: number

  @column()
  declare stageGroupId: number | null

  @column()
  declare positionStart: number

  @column()
  declare positionEnd: number

  @column()
  declare zoneType: ZoneType

  @column()
  declare label: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Stage)
  declare stage: BelongsTo<typeof Stage>

  @belongsTo(() => StageGroup)
  declare stageGroup: BelongsTo<typeof StageGroup>
}
