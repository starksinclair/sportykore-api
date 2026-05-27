import { BaseTransformer } from '@adonisjs/core/transformers'
import type Standing from '#models/standing'
import TeamTransformer from '#transformers/team_transformer'

export default class StandingTransformer extends BaseTransformer<Standing> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'position',
        'played',
        'wins',
        'draws',
        'losses',
        'goalsFor',
        'goalsAgainst',
        'goalDifference',
        'points',
        'form',
      ]),
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team)),
    }
  }
}
