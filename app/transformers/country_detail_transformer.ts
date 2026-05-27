import type Game from '#models/game'
import type League from '#models/league'
import type Team from '#models/team'
import type Country from '#models/country'
import {
  formatIsoDate,
  formatKickoffLabel,
  formatMatchStatusLabel,
  formatScoreline,
} from '#helpers/match_format'
import type { CountryDetailFeaturedPlayer, CountryDetailStats } from '#services/country_service'

export type CountryDetailPayload = {
  country: Country
  stats: CountryDetailStats
  leagues: League[]
  teams: Team[]
  featuredPlayers: CountryDetailFeaturedPlayer[]
  recentMatches: Game[]
}

export function transformCountryDetail(payload: CountryDetailPayload) {
  const { country, stats, leagues, teams, featuredPlayers, recentMatches } = payload

  return {
    country: {
      id: country.id,
      name: country.name,
      code: country.code,
    },
    stats,
    leagues: leagues.map((league) => ({
      id: String(league.id),
      name: league.name,
      country: {
        code: league.country?.code ?? country.code,
        name: league.country?.name ?? country.name,
      },
    })),
    teams: teams.map((team) => ({
      id: String(team.id),
      name: team.name,
      logoUrl: team.logoUrl,
    })),
    featuredPlayers,
    recentMatches: recentMatches.map((game) => transformRecentMatch(game, country)),
  }
}

function transformRecentMatch(game: Game, fallbackCountry: Country) {
  const league = game.league
  const country = league?.country ?? fallbackCountry
  const status = game.status ?? 'scheduled'

  return {
    id: String(game.id),
    homeTeam: {
      id: String(game.homeTeam.id),
      name: game.homeTeam.name,
    },
    awayTeam: {
      id: String(game.awayTeam.id),
      name: game.awayTeam.name,
    },
    league: {
      id: String(league?.id ?? game.leagueId),
      name: league?.name ?? '',
      country: {
        code: country.code,
        name: country.name,
      },
    },
    country: {
      code: country.code,
      name: country.name,
    },
    scoreline: formatScoreline(game.homeScore, game.awayScore),
    status: formatMatchStatusLabel(status),
    kickoffLabel: formatKickoffLabel(game.playedAt),
    venue: game.venueName,
    round:
      game.$extras.matchday !== null && game.$extras.matchday !== undefined
        ? `Matchday ${game.$extras.matchday}`
        : null,
    live: status === 'live',
    isoDate: formatIsoDate(game.playedAt),
  }
}
