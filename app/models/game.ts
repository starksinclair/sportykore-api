import { GameSchema } from '#database/schema'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Season from '#models/season'
import { afterSave, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import Team from '#models/team'
import League from '#models/league'
import Stat from '#models/stat'
import GameLineup from '#models/game_lineup'
import Venue from '#models/venue'
import Stage from '#models/stage'
import Tie from '#models/tie'
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

  @belongsTo(() => Venue)
  declare venue: BelongsTo<typeof Venue>

  @belongsTo(() => Stage)
  declare stage: BelongsTo<typeof Stage>

  @belongsTo(() => Tie)
  declare tie: BelongsTo<typeof Tie>

  @belongsTo(() => Team, { foreignKey: 'winnerTeamId' })
  declare winnerTeam: BelongsTo<typeof Team>

  @hasMany(() => Stat)
  declare stats: HasMany<typeof Stat>

  @hasMany(() => GameLineup)
  declare lineups: HasMany<typeof GameLineup>

  @afterSave()
  static async onSave(game: Game) {
    // const resultChanged =
    //   game.$dirty.homeScore !== undefined ||
    //   game.$dirty.awayScore !== undefined ||
    //   (game.$dirty.status !== undefined && game.status === 'full_time')

    // if (resultChanged) {
    const dispatch = () => events.GameUpdated.dispatch(game, 'result')

    const trx = game.$trx
    if (trx?.isTransaction && !trx.isCompleted) {
      trx.after('commit', () => dispatch())
      return
    }

    await dispatch()
    // }
  }
}
