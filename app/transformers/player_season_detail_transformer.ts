import { BaseTransformer } from '@adonisjs/core/transformers'
import type Game from '#models/game'
import type Season from '#models/season'
import type Stat from '#models/stat'
import type Team from '#models/team'
import GameTransformer from '#transformers/game_transformer'
import StatTransformer from '#transformers/stat_transformer'
import TeamTransformer from '#transformers/team_transformer'

export type PlayerSeasonDetail = {
  season: Season
  team: Team | null
  position: string | null
  games: Game[]
  stats: Stat[]
}

export default class PlayerSeasonDetailTransformer extends BaseTransformer<PlayerSeasonDetail> {
  toObject() {
    const { season, team, position, games, stats } = this.resource

    return {
      id: season.id,
      name: season.name,
      status: season.status,
      team: TeamTransformer.transform(team),
      position,
      games: GameTransformer.transform(games)?.depth(3),
      stats: StatTransformer.transform(stats)?.depth(2),
    }
  }
}
