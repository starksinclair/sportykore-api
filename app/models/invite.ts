import { InviteSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'

export default class Invite extends InviteSchema {
  @belongsTo(() => User)
  declare invitedUser: BelongsTo<typeof User>

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>
}
