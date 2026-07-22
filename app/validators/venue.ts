import vine from '@vinejs/vine'

export const createVenueValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  address: vine.string().trim().maxLength(500).nullable().optional(),
  latitude: vine.number().min(-90).max(90).nullable().optional(),
  longitude: vine.number().min(-180).max(180).nullable().optional(),
  googlePlaceId: vine.string().trim().maxLength(255).nullable().optional(),
  capacity: vine.number().withoutDecimals().min(0).max(999999).nullable().optional(),
  city: vine.string().trim().maxLength(120).nullable().optional(),
  notes: vine.string().trim().nullable().optional(),
})

export const updateVenueValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  address: vine.string().trim().maxLength(500).nullable().optional(),
  latitude: vine.number().min(-90).max(90).nullable().optional(),
  longitude: vine.number().min(-180).max(180).nullable().optional(),
  googlePlaceId: vine.string().trim().maxLength(255).nullable().optional(),
  capacity: vine.number().withoutDecimals().min(0).max(999999).nullable().optional(),
  city: vine.string().trim().maxLength(120).nullable().optional(),
  notes: vine.string().trim().nullable().optional(),
})
