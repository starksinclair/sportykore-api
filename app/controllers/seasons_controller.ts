import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Season from '#models/season'
import { createSeasonValidator, updateSeasonValidator } from '#validators/season'
import StageService from '#services/stage_service'
import GroupStageService from '#services/group_stage_service'
import type { CompetitionFormat } from '#services/league_service'
import { inject } from '@adonisjs/core'

@inject()
export default class SeasonsController {
  constructor(
    protected stageService: StageService = new StageService(),
    protected groupStageService: GroupStageService = new GroupStageService()
  ) {}

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createSeasonValidator)
    const format: CompetitionFormat = data.format ?? 'league'

    if (format === 'knockout') {
      if (!data.knockout?.config?.ties?.default?.tie_format) {
        throw new Exception('knockout.config is required when format is knockout', {
          status: 422,
        })
      }
      this.stageService.assertKnockoutTieConfig({
        format: {
          starting_round: data.knockout.config.format?.starting_round,
          has_third_place: data.knockout.config.format?.has_third_place ?? false,
        },
        ties: data.knockout.config.ties,
      })
    }

    const { season, stage } = await db.transaction(async (trx) => {
      if (data.status === 'active') {
        await this.completeOtherActiveSeasons(data.leagueId, trx)
      }

      const created = await Season.create(
        {
          leagueId: data.leagueId,
          name: data.name,
          status: data.status,
        },
        { client: trx }
      )

      let createdStage
      if (format === 'knockout') {
        createdStage = await this.stageService.createKnockoutStage(
          data.leagueId,
          created.id,
          {
            name: data.knockout?.name ?? 'Cup',
            config: {
              format: {
                starting_round: data.knockout!.config.format?.starting_round,
                has_third_place: data.knockout!.config.format?.has_third_place ?? false,
              },
              ties: data.knockout!.config.ties,
            },
          },
          trx
        )
      } else if (format === 'group') {
        const { stage: groupStage } = await this.groupStageService.createGroupStage(
          data.leagueId,
          created.id,
          {
            name: data.group?.name ?? 'Group Stage',
            config: data.group?.config,
          },
          trx
        )
        createdStage = groupStage
      } else {
        createdStage = await this.stageService.ensureRoundRobinStage(created.id, trx)
      }

      return { season: created, stage: createdStage }
    })

    return response.created({
      id: season.id,
      leagueId: season.leagueId,
      name: season.name,
      status: season.status,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt,
      stageId: stage.id,
      format,
      seeded: false,
    })
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
