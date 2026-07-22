import { BaseTransformer } from '@adonisjs/core/transformers'
import type Tie from '#models/tie'
import TeamTransformer from '#transformers/team_transformer'
import GameTransformer from '#transformers/game_transformer'

export default class TieTransformer extends BaseTransformer<Tie> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'stageId',
        'round',
        'bracketPosition',
        'tieFormat',
        'bestOf',
        'targetWins',
        'awayGoals',
        'isBye',
        'homeScoreAgg',
        'awayScoreAgg',
        'status',
      ]),
      homeTeam: TeamTransformer.transform(this.whenLoaded(this.resource.homeTeam)),
      awayTeam: TeamTransformer.transform(this.whenLoaded(this.resource.awayTeam)),
      winnerTeam: TeamTransformer.transform(this.whenLoaded(this.resource.winnerTeam)),
      games: GameTransformer.transform(this.whenLoaded(this.resource.games))?.depth(3),
    }
  }
}
