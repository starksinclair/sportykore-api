import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'
import { BRACKET_ROUNDS, TIE_FORMATS } from '#types/stage'

const tieFormatFields = {
  tie_format: vine.enum(TIE_FORMATS),
  best_of: vine.number().withoutDecimals().min(1).max(15).optional(),
  away_goals: vine.boolean().optional(),
}

/** Shared knockout stage `config` object (create stage / create competition). */
export const knockoutStageConfigSchema = vine.object({
  format: vine
    .object({
      starting_round: vine.enum(BRACKET_ROUNDS).optional(),
      has_third_place: vine.boolean().optional(),
    })
    .optional(),
  ties: vine.object({
    default: vine.object(tieFormatFields),
    rounds: vine
      .object({
        r256: vine.object(tieFormatFields).optional(),
        r128: vine.object(tieFormatFields).optional(),
        r64: vine.object(tieFormatFields).optional(),
        r32: vine.object(tieFormatFields).optional(),
        r16: vine.object(tieFormatFields).optional(),
        qf: vine.object(tieFormatFields).optional(),
        sf: vine.object(tieFormatFields).optional(),
        final: vine.object(tieFormatFields).optional(),
        third_place: vine.object(tieFormatFields).optional(),
      })
      .optional(),
  }),
})

export const createKnockoutStageValidator = vine.create({
  seasonId: resourceId('seasons'),
  name: vine.string().trim().minLength(1).maxLength(255),
  sequence: vine.number().withoutDecimals().min(1).optional(),
  config: knockoutStageConfigSchema,
})

export const seedKnockoutStageValidator = vine.create({
  seededTeams: vine.array(resourceId('teams')).minLength(2),
})

export const nextRoundValidator = vine.create({
  completedRound: vine.enum(BRACKET_ROUNDS),
})

export const completePenaltyShootoutValidator = vine.create({
  homePenaltyScore: vine.number().withoutDecimals().min(0).max(50),
  awayPenaltyScore: vine.number().withoutDecimals().min(0).max(50),
})
