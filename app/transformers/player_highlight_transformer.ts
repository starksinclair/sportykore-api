import { BaseTransformer } from '@adonisjs/core/transformers'

import type PlayerHighlight from '#models/player_highlight'
import { youTubeThumbnailUrl } from '#helpers/youtube'

export default class PlayerHighlightTransformer extends BaseTransformer<PlayerHighlight> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'videoId', 'title', 'sortOrder']),
      thumbnailUrl: youTubeThumbnailUrl(this.resource.videoId),
    }
  }
}
