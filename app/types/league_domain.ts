import type Game from '#models/game'
import type League from '#models/league'
import type Season from '#models/season'
import type Stat from '#models/stat'
import type Team from '#models/team'

/** Row from standings computation before API serialization. */
export type StandingAggregate = {
  position: number
  team: Team
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form: string[]
}

export type LeagueWithGamesRow = {
  league: League
  matches: Game[]
  countryCode: string
}

export type LeagueDetailBundle = {
  league: League
  season: Season | null
  games: Game[]
  standings: StandingAggregate[]
  stats: Stat[]
}
