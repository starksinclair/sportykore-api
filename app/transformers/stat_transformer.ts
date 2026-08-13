import { BaseTransformer } from '@adonisjs/core/transformers'
import type Stat from '#models/stat'
import TeamTransformer from '#transformers/team_transformer'
import PlayerTransformer from '#transformers/player_transformer'
import StatTypeTransformer from '#transformers/stats_type_transformer'

export default class StatTransformer extends BaseTransformer<Stat> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'minute', 'isStoppageTime', 'isPenalty', 'numericValue']),
      clientEventId: this.resource.clientEventId,
      qualifiers: normalizeQualifiers(this.resource.qualifiers),
      isUnaccredited: this.resource.playerId === null,
      type: StatTypeTransformer.transform(this.whenLoaded(this.resource.type)),
      team: TeamTransformer.transform(this.whenLoaded(this.resource.team)),
      player: PlayerTransformer.transform(this.whenLoaded(this.resource.player)),
      relatedPlayer: PlayerTransformer.transform(this.whenLoaded(this.resource.relatedPlayer)),
    }
  }
}

function normalizeQualifiers(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}
