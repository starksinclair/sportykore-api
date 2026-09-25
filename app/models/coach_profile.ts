import { CoachProfileSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Country from '#models/country'
import PlayerSocialLink from '#models/player_social_link'
import User from '#models/user'
import type { CoachAvailability, CoachVisibility } from '#types/coach'

export default class CoachProfile extends CoachProfileSchema {
  declare availability: CoachAvailability
  declare visibility: CoachVisibility

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Country)
  declare country: BelongsTo<typeof Country>

  @hasMany(() => PlayerSocialLink, { foreignKey: 'coachProfileId' })
  declare socialLinks: HasMany<typeof PlayerSocialLink>
}
