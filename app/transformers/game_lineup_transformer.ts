import { BaseTransformer } from '@adonisjs/core/transformers'
import type GameLineup from '#models/game_lineup'
import type { TeamLineupGroup } from '#services/lineup_service'
import FormationTransformer from '#transformers/formation_transformer'
import PlayerTransformer from '#transformers/player_transformer'
import TeamTransformer from '#transformers/team_transformer'

export default class GameLineupTransformer extends BaseTransformer<GameLineup> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'gameId',
        'teamId',
        'playerId',
        'formationId',
        'slotKey',
        'status',
        'position',
        'jerseyNumber',
        'startingOrder',
        'subbedInMinute',
        'subbedOutMinute',
      ]),
      player: PlayerTransformer.transform(this.whenLoaded(this.resource.player)),
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team)),
      // formation: FormationTransformer.transform(this.whenLoaded(this.resource.formation)),
    }
  }
}

export function serializeTeamLineupGroups(groups: TeamLineupGroup[]) {
  return groups.map((group) => ({
    team: TeamTransformer.transform(group.team),
    formation: FormationTransformer.transform(group.formation),
    starters: GameLineupTransformer.transform(group.starters),
    substitutes: GameLineupTransformer.transform(group.substitutes),
  }))
}
