import vine from '@vinejs/vine'

import { resourceId } from '#validators/common'
import { COACH_AVAILABILITIES, COACH_VISIBILITIES } from '#types/coach'
import { PLAYER_SOCIAL_PLATFORMS } from '#types/player'

const socialLinks = vine
  .array(
    vine.object({
      platform: vine.enum(PLAYER_SOCIAL_PLATFORMS),
      url: vine.string().trim().minLength(1).maxLength(500),
    })
  )
  .maxLength(PLAYER_SOCIAL_PLATFORMS.length)
  .optional()

const coachFields = {
  bio: vine.string().trim().maxLength(300).nullable().optional(),
  experience: vine.string().trim().maxLength(1200).nullable().optional(),
  qualifications: vine.string().trim().maxLength(1200).nullable().optional(),
  philosophy: vine.string().trim().maxLength(1200).nullable().optional(),
  countryId: resourceId('countries').nullable().optional(),
  city: vine.string().trim().maxLength(120).nullable().optional(),
  state: vine.string().trim().maxLength(120).nullable().optional(),
  availability: vine.enum(COACH_AVAILABILITIES).optional(),
  visibility: vine.enum(COACH_VISIBILITIES).optional(),
  socialLinks,
}

export const createCoachProfileValidator = vine.create({
  displayName: vine.string().trim().minLength(1).maxLength(255),
  ...coachFields,
})

export const updateCoachProfileValidator = vine.create({
  displayName: vine.string().trim().minLength(1).maxLength(255).optional(),
  ...coachFields,
})

export const coachPhotoValidator = vine.create({
  photo: vine.file({
    size: '10mb',
    extnames: ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP'],
  }),
})
