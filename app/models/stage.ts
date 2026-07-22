import { StageSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Season from '#models/season'
import StageGroup from '#models/stage_group'
import StageTeam from '#models/stage_team'
import Tie from '#models/tie'
import Game from '#models/game'

export default class Stage extends StageSchema {
  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @belongsTo(() => Stage, { foreignKey: 'sourceStageId' })
  declare sourceStage: BelongsTo<typeof Stage>

  @hasMany(() => StageGroup)
  declare groups: HasMany<typeof StageGroup>

  @hasMany(() => StageTeam)
  declare stageTeams: HasMany<typeof StageTeam>

  @hasMany(() => Tie)
  declare ties: HasMany<typeof Tie>

  @hasMany(() => Game)
  declare games: HasMany<typeof Game>
}
