import { FormationSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import GameLineup from '#models/game_lineup'

export default class Formation extends FormationSchema {
  @hasMany(() => GameLineup)
  declare lineups: HasMany<typeof GameLineup>
}
