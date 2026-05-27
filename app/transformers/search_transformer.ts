// app/transformers/search_transformer.ts
import { BaseTransformer } from '@adonisjs/core/transformers'

export type SearchHit = {
  id: string
  type: 'country' | 'league' | 'team' | 'player'
  label: string
  sublabel?: string
  countryCode?: string
}

export default class SearchTransformer extends BaseTransformer<SearchHit> {
  toObject() {
    return this.pick(this.resource, ['id', 'type', 'label', 'sublabel', 'countryCode'])
  }
}
