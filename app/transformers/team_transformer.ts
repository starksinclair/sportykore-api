import { BaseTransformer } from '@adonisjs/core/transformers'
import type Team from '#models/team'
import GameTransformer from '#transformers/game_transformer'
import TeamAdminTransformer from '#transformers/team_admin_transformer'

export default class TeamTransformer extends BaseTransformer<Team> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'logoUrl'])
  }

  withAdmins() {
    return {
      ...this.toObject(),
      admins: TeamAdminTransformer.transform(this.whenLoaded(this.resource.admins))?.depth(3),
    }
  }

  withGames() {
    return {
      ...this.toObject(),
      homeGames: GameTransformer.transform(this.whenLoaded(this.resource.homeGames)),
      awayGames: GameTransformer.transform(this.whenLoaded(this.resource.awayGames)),
    }
  }
}
