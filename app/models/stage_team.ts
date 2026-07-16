import { StageTeamSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Stage from '#models/stage'
import Team from '#models/team'
import StageGroup from '#models/stage_group'

export default class StageTeam extends StageTeamSchema {
  @belongsTo(() => Stage)
  declare stage: BelongsTo<typeof Stage>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

  @belongsTo(() => StageGroup)
  declare stageGroup: BelongsTo<typeof StageGroup>
}
