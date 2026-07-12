import { BaseTransformer } from '@adonisjs/core/transformers'
import type Formation from '#models/formation'
import type { FormationSlot } from '#types/formation'

function parseSlots(slots: Formation['slots']): FormationSlot[] {
  if (typeof slots === 'string') {
    return JSON.parse(slots) as FormationSlot[]
  }

  return slots as FormationSlot[]
}

export default class FormationTransformer extends BaseTransformer<Formation> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'displayName', 'isActive']),
      slots: parseSlots(this.resource.slots),
    }
  }
}
