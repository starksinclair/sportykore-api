import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import PlayerHighlightService from '#services/player_highlight_service'
import PlayerHighlightTransformer from '#transformers/player_highlight_transformer'
import {
  createHighlightValidator,
  reorderHighlightsValidator,
  updateHighlightValidator,
} from '#validators/player'

/**
 * YouTube highlights on the authenticated user's own player profile.
 * Ownership is the user's own player record — league owners and team
 * admins have no access (this is personal media, not league data).
 */
@inject()
export default class PlayerHighlightsController {
  constructor(protected highlightService: PlayerHighlightService) {}

  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const highlights = await this.highlightService.listOwn(user.id)
    return serialize(PlayerHighlightTransformer.transform(highlights))
  }

  async store({ auth, request, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(createHighlightValidator)
    const highlight = await this.highlightService.add(user.id, data)

    return response.created(await serialize(PlayerHighlightTransformer.transform(highlight)))
  }

  async reorder({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { ids } = await request.validateUsing(reorderHighlightsValidator)
    const highlights = await this.highlightService.reorder(user.id, ids)

    return serialize(PlayerHighlightTransformer.transform(highlights))
  }

  async update({ auth, params, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { title } = await request.validateUsing(updateHighlightValidator)
    const highlight = await this.highlightService.updateTitle(user.id, Number(params.hid), title)

    return serialize(PlayerHighlightTransformer.transform(highlight))
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await this.highlightService.destroy(user.id, Number(params.hid))
    return response.ok({ message: 'Highlight removed successfully' })
  }
}
