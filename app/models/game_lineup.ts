import { GameLineupSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Formation from '#models/formation'
import Game from '#models/game'
import Player from '#models/player'
import Team from '#models/team'

export default class GameLineup extends GameLineupSchema {
  @belongsTo(() => Game)
  declare game: BelongsTo<typeof Game>

  @belongsTo(() => Player)
  declare player: BelongsTo<typeof Player>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

  @belongsTo(() => Formation)
  declare formation: BelongsTo<typeof Formation>
}
