import type { HttpContext } from '@adonisjs/core/http'
import Venue from '#models/venue'
import VenueTransformer from '#transformers/venue_transformer'
import { createVenueValidator, updateVenueValidator } from '#validators/venue'

function coordToDb(value: number | null | undefined): string | null | undefined {
  return value === null || value === undefined ? value : value.toFixed(7)
}

export default class VenuesController {
  async index({ params, serialize }: HttpContext) {
    const venues = await Venue.query().where('league_id', params.leagueId).orderBy('name', 'asc')

    return serialize(VenueTransformer.transform(venues))
  }

  async store({ params, request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(createVenueValidator)

    await Venue.create({
      name: data.name,
      address: data.address,
      googlePlaceId: data.googlePlaceId,
      capacity: data.capacity,
      city: data.city,
      notes: data.notes,
      latitude: coordToDb(data.latitude),
      longitude: coordToDb(data.longitude),
      leagueId: Number(params.leagueId),
      createdBy: user.id,
    })

    return response.created({ message: 'Venue created successfully' })
  }

  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateVenueValidator)
    const venue = await Venue.findOrFail(params.id)

    if (data.name !== undefined) {
      venue.name = data.name
    }
    if (data.address !== undefined) {
      venue.address = data.address
    }
    if (data.googlePlaceId !== undefined) {
      venue.googlePlaceId = data.googlePlaceId
    }
    if (data.capacity !== undefined) {
      venue.capacity = data.capacity
    }
    if (data.city !== undefined) {
      venue.city = data.city
    }
    if (data.notes !== undefined) {
      venue.notes = data.notes
    }
    if (data.latitude !== undefined) {
      venue.latitude = coordToDb(data.latitude) ?? null
    }
    if (data.longitude !== undefined) {
      venue.longitude = coordToDb(data.longitude) ?? null
    }

    await venue.save()
    return response.ok({ message: 'Venue updated successfully' })
  }

  async destroy({ params, response }: HttpContext) {
    const venue = await Venue.findOrFail(params.id)
    await venue.delete()
    return response.ok({ message: 'Venue deleted successfully' })
  }
}
