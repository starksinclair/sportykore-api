import { LeagueSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import Country from '#models/country'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Season from '#models/season'
import Game from '#models/game'
import Stat from '#models/stat'
import Standing from '#models/standing'
import Invite from '#models/invite'

export default class League extends LeagueSchema {
  @belongsTo(() => Country)
  declare country: BelongsTo<typeof Country>

  @hasMany(() => Season)
  declare seasons: HasMany<typeof Season>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Game)
  declare games: HasMany<typeof Game>

  @hasMany(() => Stat)
  declare stats: HasMany<typeof Stat>

  @hasMany(() => Standing)
  declare standings: HasMany<typeof Standing>

  @hasMany(() => Invite)
  declare invites: HasMany<typeof Invite>

  @manyToMany(() => User, {
    pivotTable: 'favourite_leagues',
    pivotTimestamps: { createdAt: true, updatedAt: false },
  })
  declare favouritedBy: ManyToMany<typeof User>
}
