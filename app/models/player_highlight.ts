import { PlayerHighlightSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Player from '#models/player'

export default class PlayerHighlight extends PlayerHighlightSchema {
  @belongsTo(() => Player)
  declare player: BelongsTo<typeof Player>
}
