import { BaseTransformer } from '@adonisjs/core/transformers'
import type League from '#models/league'
import TeamSeasonDetailTransformer, {
  type TeamSeasonDetail,
} from '#transformers/team_season_detail_transformer'

export type TeamLeagueDetail = {
  league: League
  seasons: TeamSeasonDetail[]
}

export default class TeamLeagueDetailTransformer extends BaseTransformer<TeamLeagueDetail> {
  toObject() {
    const { league, seasons } = this.resource

    return {
      id: league.id,
      name: league.name,
      logoUrl: league.logoUrl,
      seasons: TeamSeasonDetailTransformer.transform(seasons)?.depth(4),
    }
  }
}
