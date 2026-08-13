import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'
import { PLAYER_POSITIONS, PREFERRED_FEET } from '#types/player'

const profileFields = {
  bio: vine.string().trim().maxLength(300).nullable().optional(),
  primaryPosition: vine.enum(PLAYER_POSITIONS).nullable().optional(),
  secondaryPosition: vine.enum(PLAYER_POSITIONS).nullable().optional(),
  preferredFoot: vine.enum(PREFERRED_FEET).nullable().optional(),
  heightCm: vine.number().withoutDecimals().min(100).max(250).nullable().optional(),
  // Stored only — the API exposes a computed `age`, never the raw date
  dateOfBirth: vine.date().nullable().optional(),
  city: vine.string().trim().maxLength(120).nullable().optional(),
  state: vine.string().trim().maxLength(120).nullable().optional(),
  nationality: vine.string().trim().maxLength(120).nullable().optional(),
  socialHandle: vine.string().trim().maxLength(120).nullable().optional(),
}

/** POST /me/player */
export const createPlayerProfileValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  countryId: resourceId('countries'),
  ...profileFields,
})

/** PUT /me/player */
export const updatePlayerProfileValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  countryId: resourceId('countries').optional(),
  ...profileFields,
})

/** POST /me/player/photo */
export const playerPhotoValidator = vine.create({
  photo: vine.file({
    size: '10mb',
    extnames: ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP'],
  }),
})

/** POST /me/player/highlights — takes a pasted URL; the video ID is parsed server-side */
export const createHighlightValidator = vine.create({
  url: vine.string().trim().maxLength(500),
  title: vine.string().trim().maxLength(140).nullable().optional(),
})

/** PUT /me/player/highlights/:hid */
export const updateHighlightValidator = vine.create({
  title: vine.string().trim().maxLength(140).nullable(),
})

/** PUT /me/player/highlights/reorder */
export const reorderHighlightsValidator = vine.create({
  ids: vine.array(vine.number().withoutDecimals().positive()).minLength(1),
})
