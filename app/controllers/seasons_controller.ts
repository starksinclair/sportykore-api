import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Season from '#models/season'
import { createSeasonValidator, updateSeasonValidator } from '#validators/season'

export default class SeasonsController {
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createSeasonValidator)

    const season = await db.transaction(async (trx) => {
      if (data.status === 'active') {
        await this.completeOtherActiveSeasons(data.leagueId, trx)
      }

      return Season.create(
        {
          leagueId: data.leagueId,
          name: data.name,
          status: data.status,
        },
        { client: trx }
      )
    })

    return response.created(season)
  }

  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateSeasonValidator)
    const season = await Season.query()
      .where('id', params.seasonId)
      .where('league_id', params.leagueId)
      .firstOrFail()

    await db.transaction(async (trx) => {
      if (data.status === 'active') {
        await this.completeOtherActiveSeasons(params.leagueId, trx, season.id)
      }

      season.useTransaction(trx)
      season.merge(data)
      await season.save()
    })

    return response.ok({ message: 'Season updated successfully' })
  }

  private async completeOtherActiveSeasons(
    leagueId: number,
    trx: TransactionClientContract,
    excludeSeasonId?: number
  ) {
    const query = Season.query({ client: trx })
      .where('league_id', leagueId)
      .where('status', 'active')

    if (excludeSeasonId !== undefined) {
      query.whereNot('id', excludeSeasonId)
    }

    await query.update({ status: 'completed' })
  }
}
