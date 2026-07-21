/** Field positions reused from the league_players roster enum. */
export const PLAYER_POSITIONS = ['goalkeeper', 'defence', 'midfield', 'attack'] as const
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number]

export const PREFERRED_FEET = ['left', 'right', 'both'] as const
export type PreferredFoot = (typeof PREFERRED_FEET)[number]

/**
 * `private` is a dormant hook reserved for a future guardian-consent flow.
 * Nothing sets it yet, but the transformer blanking behavior is live.
 */
export const PLAYER_VISIBILITIES = ['active', 'private'] as const
export type PlayerVisibility = (typeof PLAYER_VISIBILITIES)[number]

export const MAX_HIGHLIGHTS_PER_PLAYER = 10

/** Plausible age window enforced when a date of birth is supplied. */
export const MIN_PLAYER_AGE = 5
export const MAX_PLAYER_AGE = 70
