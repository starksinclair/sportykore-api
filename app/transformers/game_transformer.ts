import { BaseTransformer } from '@adonisjs/core/transformers'
import type Game from '#models/game'
import GameTimeService from '#services/game_time_service'
import TeamTransformer from '#transformers/team_transformer'
import LeagueTransformer from '#transformers/league_transformer'
import StatTransformer from '#transformers/stat_transformer'

const gameTimeService = new GameTimeService()

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
      ]),
      currentMinute: gameTimeService.calculateCurrentMinute(this.resource),
      homeTeam: TeamTransformer.transform(this.whenLoaded(this.resource.homeTeam)),
      awayTeam: TeamTransformer.transform(this.whenLoaded(this.resource.awayTeam)),
    }
  }
  forDetail() {
    return {
      ...this.toObject(),
      league: LeagueTransformer.transform(this.whenLoaded(this.resource.league)),
      stats: StatTransformer.transform(this.whenLoaded(this.resource.stats))?.depth(3),
    }
  }
}
