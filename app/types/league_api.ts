export type CountryRef = {
  id: string
  name: string
  code: string
  flagUrl?: string
}

export type LeagueRef = {
  id: string
  name: string
  logoUrl?: string
  country: CountryRef
}

export type TeamRef = {
  id: string
  name: string
  logoUrl?: string
}

export type MatchStatus =
  | 'scheduled'
  | 'first_half'
  | 'half_time'
  | 'second_half'
  | 'extra_time'
  | 'full_time'
  | 'cancelled'
  | 'postponed'
  | 'paused'

export type ApiMatch = {
  id: string
  leagueId: string
  country: string
  kickoffAt: string
  kickoffDisplay: string
  status: MatchStatus
  minuteOrPhase: string
  scoreline: string
  live: boolean
  home: TeamRef
  away: TeamRef
}

export type LeagueWithMatches = {
  league: LeagueRef
  matches: ApiMatch[]
}

export type StandingRow = {
  position: number
  team: TeamRef
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  /** Last results, most recent last (e.g. ['W','D','L']). */
  form: string[]
}

export type ApiStatRow = {
  id: string
  statType: string
  displayName: string
  gameId: string
  minute: number | null
  value: string | null
  team: TeamRef
  playerName: string | null
}

export type LeagueSeasonRef = {
  id: string
  name: string
  status: string
}

export type LeagueDetailPayload = {
  league: LeagueRef
  currentSeason: LeagueSeasonRef | null
  matches: ApiMatch[]
  standings: StandingRow[]
  stats: ApiStatRow[]
}
