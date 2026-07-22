import { BaseTransformer } from '@adonisjs/core/transformers'
import type Stage from '#models/stage'

function parseConfig(raw: unknown) {
  if (raw === null || raw === undefined) {
    return {}
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw
}

export default class StageTransformer extends BaseTransformer<Stage> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'seasonId',
        'name',
        'stageType',
        'sequence',
        'status',
        'sourceStageId',
      ]),
      config: parseConfig(this.resource.config),
    }
  }
}
