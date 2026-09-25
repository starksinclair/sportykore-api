export const COACH_AVAILABILITIES = ['open', 'not_open', 'consulting'] as const
export type CoachAvailability = (typeof COACH_AVAILABILITIES)[number]

export const COACH_VISIBILITIES = ['public', 'private'] as const
export type CoachVisibility = (typeof COACH_VISIBILITIES)[number]

export type CoachLeagueHistoryItem = {
  id: number
  role: 'team_admin'
  active: boolean
  assignedAt: string | null
  removedAt: string | null
  league: {
    id: number
    name: string
    logoUrl: string | null
  }
  team: {
    id: number
    name: string
    logoUrl: string | null
  }
}
