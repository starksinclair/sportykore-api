import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'
import { COMPETITION_FORMATS } from '#validators/league'
import { knockoutStageConfigSchema } from '#validators/stage'

const seasonStatuses = ['inactive', 'active', 'completed'] as const

export const createSeasonValidator = vine.create({
  leagueId: resourceId('leagues'),
  name: vine.string().trim().minLength(1).maxLength(255),
  status: vine.enum(seasonStatuses),
  /** Same as create competition: defaults to `league` (round_robin stage). */
  format: vine.enum(COMPETITION_FORMATS).optional(),
  knockout: vine
    .object({
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      config: knockoutStageConfigSchema,
    })
    .optional(),
})

export const updateSeasonValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  status: vine.enum(seasonStatuses).optional(),
})
