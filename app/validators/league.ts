import vine from '@vinejs/vine'
import { optionalImage, resourceId } from '#validators/common'
import { LEAGUE_TIEBREAKERS } from '#types/tiebreaker'
import { knockoutStageConfigSchema } from '#validators/stage'

const dateFormats = ['iso8601', 'YYYY-MM-DD']

export const COMPETITION_FORMATS = ['league', 'knockout'] as const

export const createLeagueWithSeasonValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  gender: vine.string().trim().maxLength(32).nullable().optional(),
  logo: optionalImage(),
  countryId: resourceId('countries'),
  seasonName: vine.string().trim().minLength(1).maxLength(120),
  tiebreaker: vine.enum(LEAGUE_TIEBREAKERS).optional(),
  startDate: vine.date({ formats: dateFormats }).nullable().optional(),
  endDate: vine.date({ formats: dateFormats }).nullable().optional(),
  /**
   * Competition format for the first season.
   * `league` (default) → round_robin stage; `knockout` → knockout stage only.
   */
  format: vine.enum(COMPETITION_FORMATS).optional(),
  knockout: vine
    .object({
      /** Stage display name (default "Cup"). */
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      /**
       * When true (default) and at least 2 teams are sent, seed the bracket in create order.
       * Set false to create an unseeded knockout stage and call seed later.
       */
      seed: vine.boolean().optional(),
      config: knockoutStageConfigSchema,
    })
    .optional(),
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
  tiebreaker: vine.enum(LEAGUE_TIEBREAKERS).optional(),
  startDate: vine.date({ formats: dateFormats }).nullable().optional(),
  endDate: vine.date({ formats: dateFormats }).nullable().optional(),
})
