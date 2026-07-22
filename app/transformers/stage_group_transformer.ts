import { BaseTransformer } from '@adonisjs/core/transformers'
import type StageGroup from '#models/stage_group'

export default class StageGroupTransformer extends BaseTransformer<StageGroup> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'stageId', 'name', 'sequence']),
    }
  }
}
