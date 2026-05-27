import vine from '@vinejs/vine'
import { optionalImage, resourceId } from '#validators/common'

export const createLeagueWithSeasonValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  gender: vine.string().trim().maxLength(32).nullable().optional(),
  logo: optionalImage(),
  countryId: resourceId('countries'),
  seasonName: vine.string().trim().minLength(1).maxLength(120),
  teams: vine
    .array(
      vine.object({
        name: vine.string().trim().minLength(1).maxLength(255),
        logo: optionalImage(),
      })
    )
    .optional(),
})

export const updateLeagueValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  gender: vine.string().trim().maxLength(32).nullable().optional(),
  logo: optionalImage(),
})
