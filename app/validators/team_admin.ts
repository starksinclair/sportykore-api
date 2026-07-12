import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

export const assignTeamAdminValidator = vine.create({
  userId: resourceId('users'),
})
