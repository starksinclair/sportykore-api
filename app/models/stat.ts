import { StatSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Game from '#models/game'
import League from '#models/league'
import Player from '#models/player'
import Season from '#models/season'
import Team from '#models/team'
import StatType from '#models/stat_type'

export default class Stat extends StatSchema {
  @belongsTo(() => Game)
  declare game: BelongsTo<typeof Game>

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @belongsTo(() => Player, { foreignKey: 'playerId' })
  declare player: BelongsTo<typeof Player>

  @belongsTo(() => Player, { foreignKey: 'relatedPlayerId' })
  declare relatedPlayer: BelongsTo<typeof Player>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

  @belongsTo(() => StatType)
  declare type: BelongsTo<typeof StatType>
}
