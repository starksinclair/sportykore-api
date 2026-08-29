import { BaseTransformer } from '@adonisjs/core/transformers'

import type PlayerSocialLink from '#models/player_social_link'

export default class PlayerSocialLinkTransformer extends BaseTransformer<PlayerSocialLink> {
  toObject() {
    return this.pick(this.resource, ['id', 'platform', 'url', 'handle'])
  }
}
