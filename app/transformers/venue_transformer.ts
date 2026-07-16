import { BaseTransformer } from '@adonisjs/core/transformers'
import type Venue from '#models/venue'

function toCoord(value: string | number | null): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export default class VenueTransformer extends BaseTransformer<Venue> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'name',
        'address',
        'googlePlaceId',
        'capacity',
        'city',
        'notes',
      ]),
      latitude: toCoord(this.resource.latitude),
      longitude: toCoord(this.resource.longitude),
    }
  }

  forGame() {
    return {
      id: this.resource.id,
      name: this.resource.name,
      address: this.resource.address,
      latitude: toCoord(this.resource.latitude),
      longitude: toCoord(this.resource.longitude),
      capacity: this.resource.capacity,
    }
  }
}
