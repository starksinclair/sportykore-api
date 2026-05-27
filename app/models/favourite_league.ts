import { FavouriteLeagueSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import User from '#models/user'
import League from '#models/league'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class FavouriteLeague extends FavouriteLeagueSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>
}
