export const LEAGUE_STATUSES = ['active', 'inactive', 'deleted'] as const

export type LeagueStatus = (typeof LEAGUE_STATUSES)[number]

export const ACTIVE_LEAGUE_STATUS: LeagueStatus = 'active'
export const INACTIVE_LEAGUE_STATUS: LeagueStatus = 'inactive'
export const DELETED_LEAGUE_STATUS: LeagueStatus = 'deleted'
