import { GameSchema } from '#database/schema'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Season from '#models/season'
import { afterSave, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import Team from '#models/team'
import League from '#models/league'
import Stat from '#models/stat'
import { events } from '#generated/events'

export default class Game extends GameSchema {
  @belongsTo(() => Team, { foreignKey: 'homeTeamId' })
  declare homeTeam: BelongsTo<typeof Team>

  @belongsTo(() => Team, { foreignKey: 'awayTeamId' })
  declare awayTeam: BelongsTo<typeof Team>

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @hasMany(() => Stat)
  declare stats: HasMany<typeof Stat>

  @afterSave()
  static async onSave(game: Game) {
    const resultChanged =
      game.$dirty.homeScore !== undefined ||
      game.$dirty.awayScore !== undefined ||
      (game.$dirty.status !== undefined && game.status === 'full_time')

    if (resultChanged) {
      await events.GameUpdated.dispatch(game, 'result')
    }
  }
}
