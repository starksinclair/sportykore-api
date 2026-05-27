import { BaseTransformer } from '@adonisjs/core/transformers'
import type Season from '#models/season'
import GameTransformer from '#transformers/game_transformer'
import LeagueTransformer from '#transformers/league_transformer'
import StandingTransformer from '#transformers/standing_transformer'
import StatTransformer from '#transformers/stat_transformer'

export default class SeasonTransformer extends BaseTransformer<Season> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'status']),
      league: LeagueTransformer.transform(this.whenLoaded(this.resource.league)),
      games: GameTransformer.transform(this.whenLoaded(this.resource.games))?.depth(3),
      standings: StandingTransformer.transform(this.whenLoaded(this.resource.standings))?.depth(2),
      stats: StatTransformer.transform(this.whenLoaded(this.resource.stats))?.depth(2),
    }
  }
}
