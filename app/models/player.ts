import { PlayerSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Team from '#models/team'
import Stat from '#models/stat'
import GameLineup from '#models/game_lineup'
import Country from '#models/country'
import PlayerHighlight from '#models/player_highlight'
import PlayerAward from '#models/player_award'
import type { PlayerPosition, PlayerVisibility, PreferredFoot } from '#types/player'

export default class Player extends PlayerSchema {
  declare primaryPosition: PlayerPosition | null
  declare secondaryPosition: PlayerPosition | null
  declare preferredFoot: PreferredFoot | null
  declare visibility: PlayerVisibility

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

  @hasMany(() => GameLineup)
  declare lineups: HasMany<typeof GameLineup>

  @hasMany(() => PlayerHighlight)
  declare highlights: HasMany<typeof PlayerHighlight>

  @hasMany(() => PlayerAward)
  declare awards: HasMany<typeof PlayerAward>

  @belongsTo(() => Country)
  declare country: BelongsTo<typeof Country>
}
