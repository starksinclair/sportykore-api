import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import Stage from '#models/stage'
import StandingOverrideService from '#services/standing_override_service'
import { createStandingOverrideValidator } from '#validators/stage'

@inject()
export default class StandingOverridesController {
  constructor(protected overrideService: StandingOverrideService) {}

  async store({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(createStandingOverrideValidator)
    const stageId = Number(params.id)
    const audit = await this.auditFromStage(stageId, request, auth)
    const rows = await this.overrideService.setCohort(
      stageId,
      {
        stageGroupId: data.stageGroupId ?? null,
        reason: data.reason ?? null,
        createdBy: auth.user?.id ?? null,
        ranks: data.ranks,
      },
      audit
    )
    return response.created({
      overrides: rows.map((r) => ({
        id: r.id,
        stageId: r.stageId,
        stageGroupId: r.stageGroupId,
        teamId: r.teamId,
        manualRank: r.manualRank,
        cohortSignature: r.cohortSignature,
        reason: r.reason,
      })),
    })
  }

  async destroy({ params, response, request, auth }: HttpContext) {
    const stageId = Number(params.id)
    const audit = await this.auditFromStage(stageId, request, auth)
    await this.overrideService.destroy(stageId, Number(params.oid), audit)
    return response.ok({ message: 'Override deleted' })
  }

  private async auditFromStage(
    stageId: number,
    request: HttpContext['request'],
    auth: HttpContext['auth']
  ) {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()
    return {
      leagueId: stage.season.leagueId,
      actorId: auth.user?.id ?? null,
      ipAddress: request.ip(),
    }
  }
}
