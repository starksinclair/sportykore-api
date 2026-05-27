import { StatTypeSchema } from '#database/schema'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { hasMany } from '@adonisjs/lucid/orm'
import Stat from '#models/stat'

export default class StatType extends StatTypeSchema {
  @hasMany(() => Stat)
  declare stats: HasMany<typeof Stat>
}
