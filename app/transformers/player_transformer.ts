import { BaseTransformer } from '@adonisjs/core/transformers'
import type Player from '#models/player'
import StatTransformer from '#transformers/stat_transformer'
import CountryTransformer from '#transformers/country_transformer'

export default class PlayerTransformer extends BaseTransformer<Player> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'avatarUrl'])
  }

  withStats() {
    return {
      ...this.toObject(),
      position: (this.resource.$extras.position as string | null | undefined) ?? null,
      stats: StatTransformer.transform(this.whenLoaded(this.resource.stats))?.depth(3),
    }
  }

  withCountry() {
    return {
      ...this.toObject(),
      country: CountryTransformer.transform(this.whenLoaded(this.resource.country)),
    }
  }
}
