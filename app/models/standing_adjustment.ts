import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Stage from '#models/stage'
import StageGroup from '#models/stage_group'
import Team from '#models/team'
import User from '#models/user'

export default class StandingAdjustment extends BaseModel {
  static table = 'standing_adjustments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare stageId: number

  @column()
  declare stageGroupId: number | null

  @column()
  declare teamId: number

  @column()
  declare pointsDelta: number

  @column()
  declare reason: string

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Stage)
  declare stage: BelongsTo<typeof Stage>

  @belongsTo(() => StageGroup)
  declare stageGroup: BelongsTo<typeof StageGroup>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>
}
