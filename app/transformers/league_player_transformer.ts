import { BaseTransformer } from '@adonisjs/core/transformers'
import type LeaguePlayer from '#models/league_player'
import LeagueTransformer from '#transformers/league_transformer'
import PlayerTransformer from '#transformers/player_transformer'
import TeamTransformer from '#transformers/team_transformer'

export default class LeaguePlayerTransformer extends BaseTransformer<LeaguePlayer> {
  toObject() {
    return this.pick(this.resource, ['id', 'status', 'position', 'jerseyNumber', 'isCaptain'])
  }

  withLeague() {
    return {
      ...this.toObject(),
      league: LeagueTransformer.transform(this.whenLoaded(this.resource.league)),
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team)),
    }
  }

  withPlayer() {
    return {
      ...this.toObject(),
      player: PlayerTransformer.transform(this.whenLoaded(this.resource.player)),
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team)),
    }
  }
}
