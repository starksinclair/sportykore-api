import { SeasonSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import League from '#models/league'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Game from '#models/game'
import Stat from '#models/stat'
import Standing from '#models/standing'
import Invite from '#models/invite'

export default class Season extends SeasonSchema {
  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @hasMany(() => Game)
  declare games: HasMany<typeof Game>

  @hasMany(() => Stat)
  declare stats: HasMany<typeof Stat>

  @hasMany(() => Standing)
  declare standings: HasMany<typeof Standing>

  @hasMany(() => Invite)
  declare invites: HasMany<typeof Invite>
}
