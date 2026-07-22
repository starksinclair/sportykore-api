import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import PlayerHighlight from '#models/player_highlight'
import PlayerProfileService from '#services/player_profile_service'
import { parseYouTubeVideoId } from '#helpers/youtube'
import { MAX_HIGHLIGHTS_PER_PLAYER } from '#types/player'

/**
 * Highlights are personal media: every method resolves the player from the
 * authenticated user's own record — league owners and team admins have no
 * access here.
 */
@inject()
export default class PlayerHighlightService {
  constructor(private profileService: PlayerProfileService) {}

  async listOwn(userId: number): Promise<PlayerHighlight[]> {
    const player = await this.profileService.findOwnOrFail(userId)
    return this.orderedHighlights(player.id)
  }

  async add(userId: number, input: { url: string; title?: string | null }) {
    const player = await this.profileService.findOwnOrFail(userId)

    const videoId = parseYouTubeVideoId(input.url)
    if (!videoId) {
      throw new Exception(
        'url must be a YouTube video link (youtube.com/watch?v=…, youtu.be/… or youtube.com/shorts/…)',
        { status: 422 }
      )
    }

    const existing = await this.orderedHighlights(player.id)
    if (existing.length >= MAX_HIGHLIGHTS_PER_PLAYER) {
      throw new Exception(`You can have at most ${MAX_HIGHLIGHTS_PER_PLAYER} highlights`, {
        status: 422,
      })
    }
    if (existing.some((highlight) => highlight.videoId === videoId)) {
      throw new Exception('This video is already on your profile', { status: 409 })
    }

    const nextSortOrder = existing.length
      ? Math.max(...existing.map((highlight) => highlight.sortOrder)) + 1
      : 0

    return PlayerHighlight.create({
      playerId: player.id,
      videoId,
      title: input.title ?? null,
      sortOrder: nextSortOrder,
    })
  }

  /** Rewrites sort_order from a full ordered array of the player's highlight IDs. */
  async reorder(userId: number, ids: number[]): Promise<PlayerHighlight[]> {
    const player = await this.profileService.findOwnOrFail(userId)
    const highlights = await this.orderedHighlights(player.id)

    const ownedIds = new Set(highlights.map((highlight) => highlight.id))
    const uniqueIds = new Set(ids)
    if (
      uniqueIds.size !== ids.length ||
      ids.length !== highlights.length ||
      ids.some((id) => !ownedIds.has(id))
    ) {
      throw new Exception('ids must contain each of your highlight IDs exactly once', {
        status: 422,
      })
    }

    await db.transaction(async (trx) => {
      for (const [index, id] of ids.entries()) {
        const highlight = highlights.find((row) => row.id === id)!
        highlight.useTransaction(trx)
        highlight.sortOrder = index
        await highlight.save()
      }
    })

    return this.orderedHighlights(player.id)
  }

  async updateTitle(userId: number, highlightId: number, title: string | null) {
    const highlight = await this.findOwnHighlight(userId, highlightId)
    highlight.title = title
    await highlight.save()
    return highlight
  }

  async destroy(userId: number, highlightId: number): Promise<void> {
    const highlight = await this.findOwnHighlight(userId, highlightId)
    await highlight.delete()
  }

  private async findOwnHighlight(userId: number, highlightId: number): Promise<PlayerHighlight> {
    const player = await this.profileService.findOwnOrFail(userId)
    const highlight = await PlayerHighlight.query()
      .where('id', highlightId)
      .where('player_id', player.id)
      .first()

    if (!highlight) {
      throw new Exception('Highlight not found', { status: 404 })
    }
    return highlight
  }

  private orderedHighlights(playerId: number): Promise<PlayerHighlight[]> {
    return PlayerHighlight.query()
      .where('player_id', playerId)
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
  }
}
