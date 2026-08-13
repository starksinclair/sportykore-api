import { PlayerAwardSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Game from '#models/game'
import Player from '#models/player'
import User from '#models/user'

export type PlayerAwardType = 'motm'

export default class PlayerAward extends PlayerAwardSchema {
  declare awardType: PlayerAwardType

  @belongsTo(() => Game)
  declare game: BelongsTo<typeof Game>

  @belongsTo(() => Player)
  declare player: BelongsTo<typeof Player>

  @belongsTo(() => User, { foreignKey: 'awardedBy' })
  declare awardedByUser: BelongsTo<typeof User>
}
