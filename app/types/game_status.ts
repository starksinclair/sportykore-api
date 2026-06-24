export const GAME_STATUSES = [
  'scheduled',
  'first_half',
  'half_time',
  'second_half',
  'extra_time',
  'full_time',
  'cancelled',
  'postponed',
  'paused',
] as const

export type GameStatus = (typeof GAME_STATUSES)[number]

/** Statuses where the match clock is actively running (client-side). */
export const LIVE_GAME_STATUSES: GameStatus[] = [
  'first_half',
  'second_half',
  'extra_time',
  'paused',
]

/** Games in these statuses count toward standings (kickoff has happened). */
export const STANDING_GAME_STATUSES: GameStatus[] = [
  'first_half',
  'half_time',
  'second_half',
  'extra_time',
  'full_time',
  'paused',
]

export function isLiveGameStatus(status: string | null | undefined): boolean {
  return LIVE_GAME_STATUSES.includes(status as GameStatus)
}

export function isStandingCountedGameStatus(status: string | null | undefined): boolean {
  return STANDING_GAME_STATUSES.includes(status as GameStatus)
}
