import { BaseTransformer } from '@adonisjs/core/transformers'
import type TeamAdmin from '#models/team_admin'
import UserTransformer from '#transformers/user_transformer'

export default class TeamAdminTransformer extends BaseTransformer<TeamAdmin> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'teamId', 'userId', 'leagueId']),
      user: UserTransformer.transform(this.whenLoaded(this.resource.user))?.depth(1),
    }
  }
}
