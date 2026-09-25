import { BaseTransformer } from '@adonisjs/core/transformers'

import type CoachProfile from '#models/coach_profile'
import CountryTransformer from '#transformers/country_transformer'
import PlayerSocialLinkTransformer from '#transformers/player_social_link_transformer'
import type { CoachLeagueHistoryItem } from '#types/coach'

export default class CoachProfileTransformer extends BaseTransformer<CoachProfile> {
  toObject() {
    if (this.isPrivate()) {
      return this.privateStub()
    }

    return this.fullProfile()
  }

  ownProfile() {
    return this.fullProfile()
  }

  private fullProfile() {
    return {
      ...this.pick(this.resource, [
        'id',
        'displayName',
        'photoUrl',
        'bio',
        'experience',
        'qualifications',
        'philosophy',
        'city',
        'state',
        'availability',
        'visibility',
      ]),
      country: CountryTransformer.transform(this.whenLoaded(this.resource.country)),
      socialLinks: PlayerSocialLinkTransformer.transform(this.whenLoaded(this.resource.socialLinks)),
      leagues: (this.resource.$extras.leagues ?? []) as CoachLeagueHistoryItem[],
    }
  }

  private isPrivate() {
    return this.resource.visibility === 'private'
  }

  private privateStub() {
    return {
      id: this.resource.id,
      displayName: this.resource.displayName,
      visibility: 'private' as const,
    }
  }
}
