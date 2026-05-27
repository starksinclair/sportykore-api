import { BaseTransformer } from '@adonisjs/core/transformers'
import type Game from '#models/game'
import type Player from '#models/player'
import type Season from '#models/season'
import type Standing from '#models/standing'
import GameTransformer from '#transformers/game_transformer'
import PlayerTransformer from '#transformers/player_transformer'
import StandingTransformer from '#transformers/standing_transformer'

export type TeamSeasonDetail = {
  season: Season
  games: Game[]
  standings: Standing[]
  players: Player[]
}

export default class TeamSeasonDetailTransformer extends BaseTransformer<TeamSeasonDetail> {
  toObject() {
    const { season, games, standings, players } = this.resource

    return {
      id: season.id,
      name: season.name,
      status: season.status,
      games: GameTransformer.transform(games)?.depth(3),
      standings: StandingTransformer.transform(standings)?.depth(2),
      players: PlayerTransformer.transform(players)?.useVariant('withStats')?.depth(2),
    }
  }
}
