import { BaseTransformer } from '@adonisjs/core/transformers'
import type Team from '#models/team'
import GameTransformer from '#transformers/game_transformer'

export default class TeamTransformer extends BaseTransformer<Team> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'logoUrl'])
  }

  withGames() {
    return {
      ...this.toObject(),
      homeGames: GameTransformer.transform(this.whenLoaded(this.resource.homeGames)),
      awayGames: GameTransformer.transform(this.whenLoaded(this.resource.awayGames)),
    }
  }
}
