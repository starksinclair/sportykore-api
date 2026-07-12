import { BaseTransformer } from '@adonisjs/core/transformers'
import GameLineupTransformer from '#transformers/game_lineup_transformer'
import { type TeamLineupGroup } from '#services/lineup_service'
import TeamTransformer from '#transformers/team_transformer'
import FormationTransformer from '#transformers/formation_transformer'

export default class LineupGroupTransformer extends BaseTransformer<TeamLineupGroup> {
  constructor(resource: TeamLineupGroup) {
    super(resource)
  }
  toObject() {
    return {
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team))?.depth(3)?.useVariant('withAdmins'),
      formation: FormationTransformer.transform(this.whenLoaded(this.resource.formation)),
      starters: GameLineupTransformer.transform(this.whenLoaded(this.resource.starters))?.depth(2),
      substitutes: GameLineupTransformer.transform(
        this.whenLoaded(this.resource.substitutes)
      )?.depth(2),
    }
  }
}
