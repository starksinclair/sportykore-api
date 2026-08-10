import { BaseTransformer } from '@adonisjs/core/transformers'
import { DateTime } from 'luxon'

import type Player from '#models/player'
import StatTransformer from '#transformers/stat_transformer'
import CountryTransformer from '#transformers/country_transformer'
import PlayerHighlightTransformer from '#transformers/player_highlight_transformer'
import PlayerAwardTransformer from '#transformers/player_award_transformer'

/**
 * The single serialization path for players. Two invariants live here:
 *
 * 1. `date_of_birth` is NEVER serialized — only the computed `age`.
 * 2. A `visibility = 'private'` player serializes to a minimal stub (id,
 *    display name, visibility) on EVERY variant, so rosters, lineups, stats,
 *    search and leaderboards can't leak a blanked profile.
 */
export default class PlayerTransformer extends BaseTransformer<Player> {
  toObject() {
    if (this.isPrivate()) {
      return this.privateStub()
    }

    return {
      ...this.pick(this.resource, ['id', 'name', 'avatarUrl']),
      visibility: this.resource.visibility,
    }
  }

  withStats() {
    if (this.isPrivate()) {
      return this.privateStub()
    }

    return {
      ...this.toObject(),
      position: (this.resource.$extras.position as string | null | undefined) ?? null,
      stats: StatTransformer.transform(this.whenLoaded(this.resource.stats))?.depth(3),
    }
  }

  withCountry() {
    if (this.isPrivate()) {
      return this.privateStub()
    }

    return {
      ...this.toObject(),
      country: CountryTransformer.transform(this.whenLoaded(this.resource.country)),
    }
  }

  /** Full public profile — used by GET /players/:id and GET /me/player. */
  profile() {
    if (this.isPrivate()) {
      return this.privateStub()
    }

    return {
      ...this.pick(this.resource, [
        'id',
        'name',
        'avatarUrl',
        'bio',
        'primaryPosition',
        'secondaryPosition',
        'preferredFoot',
        'heightCm',
        'city',
        'state',
        'nationality',
        'socialHandle',
        'visibility',
      ]),
      age: this.age(),
      country: CountryTransformer.transform(this.whenLoaded(this.resource.country)),
      highlights: PlayerHighlightTransformer.transform(this.whenLoaded(this.resource.highlights)),
      awards: PlayerAwardTransformer.transform(this.whenLoaded(this.resource.awards))
        ?.useVariant('forPlayerProfile')
        ?.depth(3),
    }
  }

  private isPrivate() {
    return this.resource.visibility === 'private'
  }

  private privateStub() {
    return {
      id: this.resource.id,
      name: this.resource.name,
      visibility: 'private' as const,
    }
  }

  private age(): number | null {
    const dateOfBirth = this.resource.dateOfBirth
    if (!dateOfBirth) {
      return null
    }
    return Math.max(0, Math.floor(DateTime.now().diff(dateOfBirth, 'years').years))
  }
}
