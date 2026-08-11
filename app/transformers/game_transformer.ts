import { BaseTransformer } from '@adonisjs/core/transformers'
import type Game from '#models/game'
import type GameLineup from '#models/game_lineup'
import type Stat from '#models/stat'
import GameTimeService from '#services/game_time_service'
import TeamTransformer from '#transformers/team_transformer'
import LeagueTransformer from '#transformers/league_transformer'
import StatTransformer from '#transformers/stat_transformer'
import LineupGroupTransformer from '#transformers/lineup_group_transformer'
import VenueTransformer from '#transformers/venue_transformer'
import PlayerAwardTransformer from '#transformers/player_award_transformer'
import { groupLineupsByTeam } from '#services/lineup_service'
import { computeMatchTrackingMetrics } from '#services/stat_service'

const gameTimeService = new GameTimeService()
const TIMELINE_STAT_TYPES = new Set(['goals', 'own_goal', 'assists', 'yellow_card', 'red_card'])

export default class GameTransformer extends BaseTransformer<Game> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'status',
        'homeScore',
        'awayScore',
        'firstHalfDuration',
        'secondHalfDuration',
        'extraTimeDuration',
        'firstHalfStartedAt',
        'secondHalfStartedAt',
        'extraTimeStartedAt',
        'pausedAt',
        'pausedFromStatus',
        'playedAt',
        'venueName',
        'stageId',
        'tieId',
        'leg',
        'round',
        'bracketPosition',
        'homePenaltyScore',
        'awayPenaltyScore',
      ]),
      currentMinute: gameTimeService.calculateCurrentMinute(this.resource),
      homeTeam: TeamTransformer.transform(this.whenLoaded(this.resource.homeTeam)),
      awayTeam: TeamTransformer.transform(this.whenLoaded(this.resource.awayTeam)),
      winnerTeam: TeamTransformer.transform(this.whenLoaded(this.resource.winnerTeam)),
      awards: PlayerAwardTransformer.transform(this.whenLoaded(this.resource.awards))?.depth(3),
      venueId: this.resource.venueId,
      venue: VenueTransformer.transform(this.whenLoaded(this.resource.venue))
        ?.useVariant('forGame')
        ?.depth(2),
    }
  }
  forDetail() {
    const lineups = (this.resource.lineups as GameLineup[] | undefined) ?? []
    const groupedLineups = groupLineupsByTeam(lineups)

    return {
      ...this.toObject(),
      league: LeagueTransformer.transform(this.whenLoaded(this.resource.league)),
      stats: StatTransformer.transform(this.whenLoaded(timelineStats(this.resource.stats)))?.depth(
        3
      ),
      tracking: computeMatchTrackingMetrics(
        this.resource.stats,
        this.resource.homeTeamId,
        this.resource.awayTeamId
      ),
      lineups: LineupGroupTransformer.transform(this.whenLoaded(groupedLineups))?.depth(4),
    }
  }
}

function timelineStats(stats: Stat[] | undefined): Stat[] | undefined {
  if (!stats) return stats
  return stats.filter((stat) => {
    const name = stat.type?.name?.toLowerCase()
    return name !== undefined && TIMELINE_STAT_TYPES.has(name)
  })
}
