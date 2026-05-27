import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

export const generateInviteValidator = vine.create({
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
  teamId: resourceId('teams'),
  invitedUserId: resourceId('users').optional(),
})
