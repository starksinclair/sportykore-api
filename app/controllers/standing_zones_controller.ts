import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import Stage from '#models/stage'
import StandingZone from '#models/standing_zone'
import StandingZoneService from '#services/standing_zone_service'
import { createStandingZoneValidator, updateStandingZoneValidator } from '#validators/stage'

@inject()
export default class StandingZonesController {
  constructor(protected zoneService: StandingZoneService) {}

  async index({ params }: HttpContext) {
    const rows = await this.zoneService.list(Number(params.id))
    // serialize() returns plain arrays unwrapped; wrap explicitly to keep the
    // documented `{ data: [...] }` envelope.
    return { data: rows.map((r) => this.toJson(r)) }
  }

  async store({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(createStandingZoneValidator)
    const stageId = Number(params.id)
    const audit = await this.auditFromStage(stageId, request, auth)
    const row = await this.zoneService.create(stageId, data, audit)
    return response.created(this.toJson(row))
  }

  async update({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(updateStandingZoneValidator)
    const zone = await StandingZone.findOrFail(Number(params.zid))
    const audit = await this.auditFromStage(zone.stageId, request, auth)
    const row = await this.zoneService.update(zone.id, data, audit)
    return response.ok(this.toJson(row))
  }

  async destroy({ params, response, request, auth }: HttpContext) {
    const zone = await StandingZone.findOrFail(Number(params.zid))
    const audit = await this.auditFromStage(zone.stageId, request, auth)
    await this.zoneService.destroy(zone.id, audit)
    return response.ok({ message: 'Zone deleted' })
  }

  private toJson(row: StandingZone) {
    return {
      id: row.id,
      stageId: row.stageId,
      stageGroupId: row.stageGroupId,
      positionStart: row.positionStart,
      positionEnd: row.positionEnd,
      zoneType: row.zoneType,
      label: row.label,
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
