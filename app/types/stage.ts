export const STAGE_TYPES = ['round_robin', 'group', 'knockout', 'playoff'] as const
export type StageType = (typeof STAGE_TYPES)[number]

export const STAGE_STATUSES = ['upcoming', 'active', 'completed'] as const
export type StageStatus = (typeof STAGE_STATUSES)[number]

export const BRACKET_ROUNDS = [
  'r256',
  'r128',
  'r64',
  'r32',
  'r16',
  'qf',
  'sf',
  'final',
  'third_place',
] as const
export type BracketRound = (typeof BRACKET_ROUNDS)[number]

/** Rounds that participate in nextRound progression (excludes third_place). */
export const PROGRESSION_ROUNDS = [
  'r256',
  'r128',
  'r64',
  'r32',
  'r16',
  'qf',
  'sf',
  'final',
] as const
export type ProgressionRound = (typeof PROGRESSION_ROUNDS)[number]

export const TIE_FORMATS = ['single', 'two_legged', 'best_of'] as const
export type TieFormat = (typeof TIE_FORMATS)[number]

export const TIE_STATUSES = ['pending', 'in_progress', 'completed'] as const
export type TieStatus = (typeof TIE_STATUSES)[number]

export type TieFormatConfig = {
  tie_format: TieFormat
  best_of?: number
  away_goals?: boolean
}

export type KnockoutStageConfig = {
  format: {
    starting_round?: BracketRound
    has_third_place?: boolean
  }
  ties: {
    default: TieFormatConfig
    rounds?: Partial<Record<BracketRound, TieFormatConfig>>
  }
}
