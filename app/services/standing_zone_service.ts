import { Exception } from '@adonisjs/core/exceptions'

import Stage from '#models/stage'
import StandingZone from '#models/standing_zone'
import type { ZoneType } from '#types/standing'
import AuditService from '#services/audit_service'
import { inject } from '@adonisjs/core'

@inject()
export default class StandingZoneService {
  constructor(private auditService: AuditService = new AuditService()) {}

  async list(stageId: number) {
    await this.assertTableStage(stageId)
    return StandingZone.query()
      .where('stage_id', stageId)
      .orderBy('position_start', 'asc')
      .orderBy('id', 'asc')
  }

  async create(
    stageId: number,
    input: {
      stageGroupId?: number | null
      positionStart: number
      positionEnd: number
      zoneType: ZoneType
      label?: string | null
    },
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    await this.assertTableStage(stageId)
    this.assertRange(input.positionStart, input.positionEnd)

    const zone = await StandingZone.create({
      stageId,
      stageGroupId: input.stageGroupId ?? null,
      positionStart: input.positionStart,
      positionEnd: input.positionEnd,
      zoneType: input.zoneType,
      label: input.label ?? null,
    })

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_zone.created',
        entityType: 'standing_zone',
        entityId: zone.id,
        metadata: {
          stageId,
          stageGroupId: zone.stageGroupId,
          positionStart: zone.positionStart,
          positionEnd: zone.positionEnd,
          zoneType: zone.zoneType,
          label: zone.label,
        },
        ipAddress: audit.ipAddress,
      })
    }

    return zone
  }

  async update(
    zoneId: number,
    input: {
      stageGroupId?: number | null
      positionStart?: number
      positionEnd?: number
      zoneType?: ZoneType
      label?: string | null
    },
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const zone = await StandingZone.findOrFail(zoneId)
    await this.assertTableStage(zone.stageId)

    const positionStart = input.positionStart ?? zone.positionStart
    const positionEnd = input.positionEnd ?? zone.positionEnd
    this.assertRange(positionStart, positionEnd)

    zone.merge({
      stageGroupId: input.stageGroupId !== undefined ? input.stageGroupId : zone.stageGroupId,
      positionStart,
      positionEnd,
      zoneType: input.zoneType ?? zone.zoneType,
      label: input.label !== undefined ? input.label : zone.label,
    })
    await zone.save()

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_zone.updated',
        entityType: 'standing_zone',
        entityId: zone.id,
        metadata: {
          stageId: zone.stageId,
          positionStart: zone.positionStart,
          positionEnd: zone.positionEnd,
          zoneType: zone.zoneType,
          label: zone.label,
        },
        ipAddress: audit.ipAddress,
      })
    }

    return zone
  }

  async destroy(
    zoneId: number,
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const zone = await StandingZone.findOrFail(zoneId)
    await this.assertTableStage(zone.stageId)
    const snapshot = {
      stageId: zone.stageId,
      stageGroupId: zone.stageGroupId,
      positionStart: zone.positionStart,
      positionEnd: zone.positionEnd,
      zoneType: zone.zoneType,
    }
    await zone.delete()

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_zone.deleted',
        entityType: 'standing_zone',
        entityId: zoneId,
        metadata: snapshot,
        ipAddress: audit.ipAddress,
      })
    }
  }

  private assertRange(start: number, end: number) {
    if (start < 1 || end < start) {
      throw new Exception('positionStart must be >= 1 and positionEnd >= positionStart', {
        status: 422,
      })
    }
  }

  private async assertTableStage(stageId: number) {
    const stage = await Stage.findOrFail(stageId)
    if (stage.stageType === 'knockout' || stage.stageType === 'playoff') {
      throw new Exception('Standing zones are only valid for round_robin and group stages', {
        status: 422,
      })
    }
    return stage
  }
}
