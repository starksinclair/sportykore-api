import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminTeamManagedResource } from '#services/user_manage_service'
import SeasonTransformer from '#transformers/season_transformer'

export default class AdminTeamManagedTransformer extends BaseTransformer<AdminTeamManagedResource> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'logoUrl']),
      league: {
        id: this.resource.league.id,
        name: this.resource.league.name,
        logoUrl: this.resource.league.logoUrl,
      },
      activeSeason: this.resource.activeSeason
        ? SeasonTransformer.transform(this.resource.activeSeason)
        : null,
      role: 'team_admin' as const,
    }
  }
}
