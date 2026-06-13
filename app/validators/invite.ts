import vine from '@vinejs/vine'
import { optionalImage, resourceId } from '#validators/common'

export const generateInviteValidator = vine.create({
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
  teamId: resourceId('teams'),
  invitedUserId: resourceId('users').optional(),
})

export const completeProfileAndAcceptValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  countryId: resourceId('countries'),
  bio: vine.string().trim().maxLength(2000).nullable().optional(),
  avatar: optionalImage(),
})
