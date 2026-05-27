import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

const seasonStatuses = ['inactive', 'active', 'completed'] as const

export const createSeasonValidator = vine.create({
  leagueId: resourceId('leagues'),
  name: vine.string().trim().minLength(1).maxLength(255),
  status: vine.enum(seasonStatuses),
})

export const updateSeasonValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  status: vine.enum(seasonStatuses).optional(),
})
