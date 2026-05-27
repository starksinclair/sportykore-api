import { BaseTransformer } from '@adonisjs/core/transformers'
import type StatType from '#models/stat_type'

export default class StatTypeTransformer extends BaseTransformer<StatType> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'displayName', 'iconName', 'category'])
  }
}
