import { CountrySchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import League from '#models/league'
import Player from '#models/player'

export default class Country extends CountrySchema {
  @hasMany(() => League)
  declare leagues: HasMany<typeof League>

  @hasMany(() => Player)
  declare players: HasMany<typeof Player>
}
