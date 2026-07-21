import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import Stage from '#models/stage'
import StandingAdjustment from '#models/standing_adjustment'
import StandingAdjustmentService from '#services/standing_adjustment_service'
import {
  createStandingAdjustmentValidator,
  updateStandingAdjustmentValidator,
} from '#validators/stage'

@inject()
export default class StandingAdjustmentsController {
  constructor(protected adjustmentService: StandingAdjustmentService) {}

  async index({ params }: HttpContext) {
    const rows = await this.adjustmentService.list(Number(params.id))
    // serialize() returns plain arrays unwrapped; wrap explicitly to keep the
    // documented `{ data: [...] }` envelope.
    return { data: rows.map((r) => this.toJson(r)) }
  }

  async store({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(createStandingAdjustmentValidator)
    const stageId = Number(params.id)
    const audit = await this.auditFromStage(stageId, request, auth)
    const row = await this.adjustmentService.create(
      stageId,
      {
        teamId: data.teamId,
        pointsDelta: data.pointsDelta,
        reason: data.reason,
        stageGroupId: data.stageGroupId ?? null,
        createdBy: auth.user?.id ?? null,
      },
      audit
    )
    return response.created(this.toJson(row))
  }

  async update({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(updateStandingAdjustmentValidator)
    const adjustment = await StandingAdjustment.findOrFail(Number(params.aid))
    const audit = await this.auditFromStage(adjustment.stageId, request, auth)
    const row = await this.adjustmentService.update(adjustment.id, data, audit)
    return response.ok(this.toJson(row))
  }

  async destroy({ params, response, request, auth }: HttpContext) {
    const adjustment = await StandingAdjustment.findOrFail(Number(params.aid))
    const audit = await this.auditFromStage(adjustment.stageId, request, auth)
    await this.adjustmentService.destroy(adjustment.id, audit)
    return response.ok({ message: 'Adjustment deleted' })
  }

  private toJson(row: StandingAdjustment) {
    return {
      id: row.id,
      stageId: row.stageId,
      stageGroupId: row.stageGroupId,
      teamId: row.teamId,
      pointsDelta: row.pointsDelta,
      reason: row.reason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
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
