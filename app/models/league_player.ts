import { LeaguePlayerSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import Player from '#models/player'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Team from '#models/team'
import Season from '#models/season'
import League from '#models/league'

export default class LeaguePlayer extends LeaguePlayerSchema {
  @belongsTo(() => Player)
  declare player: BelongsTo<typeof Player>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>
}
