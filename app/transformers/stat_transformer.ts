import { BaseTransformer } from '@adonisjs/core/transformers'
import type Stat from '#models/stat'
import TeamTransformer from '#transformers/team_transformer'
import PlayerTransformer from '#transformers/player_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'

export default class StatTransformer extends BaseTransformer<Stat> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'minute', 'isStoppageTime', 'numericValue']),
      type: StatTypeTransformer.transform(this.whenLoaded(this.resource.type)),
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team)),
      player: PlayerTransformer.transform(this.whenLoaded(this.resource.player)),
      relatedPlayer: PlayerTransformer.transform(this.whenLoaded(this.resource.relatedPlayer)),
    }
  }
}
