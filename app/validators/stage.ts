import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'
import { BRACKET_ROUNDS, TIE_FORMATS } from '#types/stage'
import { ZONE_TYPES } from '#types/standing'

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

/** Group stage config — no knockout `ties` fields. */
export const groupStageConfigSchema = vine.object({
  format: vine.object({
    group_count: vine.number().withoutDecimals().min(1).max(32),
    double_round_robin: vine.boolean().optional(),
  }),
  advancement: vine.object({
    per_group: vine.number().withoutDecimals().min(1).max(16),
  }),
})

export const createKnockoutStageValidator = vine.create({
  seasonId: resourceId('seasons'),
  name: vine.string().trim().minLength(1).maxLength(255),
  sequence: vine.number().withoutDecimals().min(1).optional(),
  stageType: vine.literal('knockout').optional(),
  config: knockoutStageConfigSchema,
})

export const createGroupStageValidator = vine.create({
  seasonId: resourceId('seasons'),
  name: vine.string().trim().minLength(1).maxLength(255),
  sequence: vine.number().withoutDecimals().min(1).optional(),
  stageType: vine.literal('group').optional(),
  config: groupStageConfigSchema.optional(),
})

export const assignGroupTeamsValidator = vine.create({
  mode: vine.enum(['manual', 'auto']),
  assignments: vine
    .array(
      vine.object({
        teamId: resourceId('teams'),
        stageGroupId: resourceId('stage_groups'),
      })
    )
    .optional(),
  teamIds: vine.array(resourceId('teams')).minLength(2).optional(),
  shuffle: vine.boolean().optional(),
})

export const generateGroupFixturesValidator = vine.create({})

export const generateKnockoutFromGroupValidator = vine.create({
  targetRound: vine.enum(BRACKET_ROUNDS).optional(),
  thirdsMode: vine.enum(['auto', 'manual']).optional(),
  selectedThirds: vine.array(resourceId('teams')).optional(),
  qualifiers: vine.array(resourceId('teams')).minLength(2).optional(),
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  force: vine.boolean().optional(),
  knockout: knockoutStageConfigSchema.optional(),
})

export const createStandingAdjustmentValidator = vine.create({
  teamId: resourceId('teams'),
  pointsDelta: vine.number().withoutDecimals().min(-50).max(50),
  reason: vine.string().trim().minLength(1).maxLength(255),
  stageGroupId: vine.number().withoutDecimals().min(1).nullable().optional(),
})

export const updateStandingAdjustmentValidator = vine.create({
  pointsDelta: vine.number().withoutDecimals().min(-50).max(50).optional(),
  reason: vine.string().trim().minLength(1).maxLength(255).optional(),
  stageGroupId: vine.number().withoutDecimals().min(1).nullable().optional(),
})

export const createStandingOverrideValidator = vine.create({
  stageGroupId: vine.number().withoutDecimals().min(1).nullable().optional(),
  reason: vine.string().trim().maxLength(2000).nullable().optional(),
  ranks: vine
    .array(
      vine.object({
        teamId: resourceId('teams'),
        manualRank: vine.number().withoutDecimals().min(1),
      })
    )
    .minLength(2),
})

export const createStandingZoneValidator = vine.create({
  stageGroupId: vine.number().withoutDecimals().min(1).nullable().optional(),
  positionStart: vine.number().withoutDecimals().min(1),
  positionEnd: vine.number().withoutDecimals().min(1),
  zoneType: vine.enum(ZONE_TYPES),
  label: vine.string().trim().maxLength(120).nullable().optional(),
})

export const updateStandingZoneValidator = vine.create({
  stageGroupId: vine.number().withoutDecimals().min(1).nullable().optional(),
  positionStart: vine.number().withoutDecimals().min(1).optional(),
  positionEnd: vine.number().withoutDecimals().min(1).optional(),
  zoneType: vine.enum(ZONE_TYPES).optional(),
  label: vine.string().trim().maxLength(120).nullable().optional(),
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
