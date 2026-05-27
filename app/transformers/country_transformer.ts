import type Country from '#models/country'
import { BaseTransformer } from '@adonisjs/core/transformers'
import LeagueTransformer from '#transformers/league_transformer'

export default class CountryTransformer extends BaseTransformer<Country> {
  constructor(
    resource: Country,
    protected userId?: number
  ) {
    super(resource)
  }
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'code']),
      leagues: LeagueTransformer.transform(this.whenLoaded(this.resource.leagues))?.depth(4),
    }
  }

  forList() {
    return this.pick(this.resource, ['id', 'name', 'code'])
  }

  WithFavourites() {
    return {
      ...this.toObject(),
      leagues: LeagueTransformer.transform(this.whenLoaded(this.resource.leagues), this.userId)
        ?.useVariant('WithFavourites')
        .depth(4),
    }
  }
}
