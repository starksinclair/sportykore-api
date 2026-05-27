import { BaseTransformer } from '@adonisjs/core/transformers'
import type League from '#models/league'
import SeasonTransformer from '#transformers/season_transformer'

export type OwnedLeagueResource = League & {
  activeSeason?: import('#models/season').default | null
}

export default class OwnedLeagueTransformer extends BaseTransformer<OwnedLeagueResource> {
  toObject() {
    const activeSeason = this.resource.activeSeason

    return {
      ...this.pick(this.resource, ['id', 'name', 'logoUrl', 'countryId']),
      activeSeason: activeSeason ? SeasonTransformer.transform(activeSeason) : null,
    }
  }
}
