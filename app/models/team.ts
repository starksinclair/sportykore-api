import { TeamSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import League from '#models/league'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Player from '#models/player'
import Game from '#models/game'
import Standing from '#models/standing'
import Invite from '#models/invite'

export default class Team extends TeamSchema {
  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => User, { foreignKey: 'addedBy' })
  declare user: BelongsTo<typeof User>

  @manyToMany(() => Player, {
    pivotTable: 'league_players',
    pivotForeignKey: 'team_id',
    pivotRelatedForeignKey: 'player_id',
    pivotColumns: ['jersey_number', 'status'],
  })
  declare players: ManyToMany<typeof Player>

  @hasMany(() => Game, { foreignKey: 'homeTeamId' })
  declare homeGames: HasMany<typeof Game>

  @hasMany(() => Game, { foreignKey: 'awayTeamId' })
  declare awayGames: HasMany<typeof Game>

  @hasMany(() => Standing)
  declare standings: HasMany<typeof Standing>

  @hasMany(() => Invite)
  declare invites: HasMany<typeof Invite>
}
