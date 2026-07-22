import { StageGroupSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Stage from '#models/stage'
import StageTeam from '#models/stage_team'

export default class StageGroup extends StageGroupSchema {
  @belongsTo(() => Stage)
  declare stage: BelongsTo<typeof Stage>

  @hasMany(() => StageTeam)
  declare stageTeams: HasMany<typeof StageTeam>
}
