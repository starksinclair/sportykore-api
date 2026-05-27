import { BaseTransformer } from '@adonisjs/core/transformers'
import type League from '#models/league'
import GameTransformer from '#transformers/game_transformer'

export default class LeagueTransformer extends BaseTransformer<League> {
  constructor(
    resource: League,
    protected userId?: number
  ) {
    super(resource)
  }
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'logoUrl', 'description']),
      games: GameTransformer.transform(this.whenLoaded(this.resource.games))?.depth(3),
    }
  }
  WithFavourites() {
    return {
      ...this.toObject(),
      isFavourited: this.userId ? Number(this.resource.$extras.is_favourited ?? 0) > 0 : false,
    }
  }
}
