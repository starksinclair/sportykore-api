import { TieSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Stage from '#models/stage'
import Team from '#models/team'
import Game from '#models/game'

export default class Tie extends TieSchema {
  @belongsTo(() => Stage)
  declare stage: BelongsTo<typeof Stage>

  @belongsTo(() => Team, { foreignKey: 'homeTeamId' })
  declare homeTeam: BelongsTo<typeof Team>

  @belongsTo(() => Team, { foreignKey: 'awayTeamId' })
  declare awayTeam: BelongsTo<typeof Team>

  @belongsTo(() => Team, { foreignKey: 'winnerTeamId' })
  declare winnerTeam: BelongsTo<typeof Team>

  @hasMany(() => Game)
  declare games: HasMany<typeof Game>
}
