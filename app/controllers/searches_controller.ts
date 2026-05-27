import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { SearchService } from '#services/search_service'
import SearchTransformer from '#transformers/search_transformer'

@inject()
export default class SearchesController {
  constructor(protected readonly searchService: SearchService) {}

  async search({ request, serialize }: HttpContext) {
    const query = (request.input('q') ?? '').toString().trim()
    const limit = this.parseLimit(request.input('limit'))

    if (!query) {
      return serialize({ query, results: [] })
    }

    const results = await this.searchService.search(query, limit)

    return serialize({
      query,
      results: SearchTransformer.transform(results.rows ?? []),
    })
  }

  private parseLimit(value: unknown) {
    const parsed = Number(value ?? 24)

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 24
    }

    return Math.min(Math.floor(parsed), 100)
  }
}
