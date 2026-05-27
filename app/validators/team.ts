import vine from '@vinejs/vine'
import { optionalImage, resourceId } from '#validators/common'

export const createTeamValidator = vine.create({
  leagueId: resourceId('leagues'),
  name: vine.string().trim().minLength(1).maxLength(255),
  logo: optionalImage(),
})

export const updateTeamValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).nullable().optional(),
  logo: optionalImage(),
})
