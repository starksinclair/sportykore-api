import { VenueSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import League from '#models/league'
import User from '#models/user'
import Game from '#models/game'

export default class Venue extends VenueSchema {
  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => Game)
  declare games: HasMany<typeof Game>
}
