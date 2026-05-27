import { PlayerSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Team from '#models/team'
import Stat from '#models/stat'
import Country from '#models/country'

export default class Player extends PlayerSchema {
  @belongsTo(() => User)
  declare added_by: BelongsTo<typeof User>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @manyToMany(() => Team, {
    pivotTable: 'league_players',
    pivotForeignKey: 'player_id',
    pivotRelatedForeignKey: 'team_id',
    pivotColumns: ['jersey_number', 'status', 'season_id', 'position'],
  })
  declare teams: ManyToMany<typeof Team>

  @hasMany(() => Stat)
  declare stats: HasMany<typeof Stat>

  @belongsTo(() => Country)
  declare country: BelongsTo<typeof Country>
}
