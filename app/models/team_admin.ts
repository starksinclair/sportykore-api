import { TeamAdminSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import League from '#models/league'
import Team from '#models/team'
import User from '#models/user'

export default class TeamAdmin extends TeamAdminSchema {
  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => League)
  declare league: BelongsTo<typeof League>
}
