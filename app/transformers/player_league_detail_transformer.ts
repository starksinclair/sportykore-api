import { BaseTransformer } from '@adonisjs/core/transformers'
import type League from '#models/league'
import PlayerSeasonDetailTransformer, {
  type PlayerSeasonDetail,
} from '#transformers/player_season_detail_transformer'

export type PlayerLeagueDetail = {
  league: League
  seasons: PlayerSeasonDetail[]
}

export default class PlayerLeagueDetailTransformer extends BaseTransformer<PlayerLeagueDetail> {
  toObject() {
    const { league, seasons } = this.resource

    return {
      id: league.id,
      name: league.name,
      logoUrl: league.logoUrl,
      startDate: league.startDate,
      endDate: league.endDate,
      seasons: PlayerSeasonDetailTransformer.transform(seasons)?.depth(4),
    }
  }
}
