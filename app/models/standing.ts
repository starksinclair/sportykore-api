import { StandingSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import Team from '#models/team'
import Season from '#models/season'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import League from '#models/league'

export default class Standing extends StandingSchema {
  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>
}
