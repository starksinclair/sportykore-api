import { Exception } from '@adonisjs/core/exceptions'

import Stage from '#models/stage'
import StandingAdjustment from '#models/standing_adjustment'
import Team from '#models/team'
import AuditService from '#services/audit_service'
import StandingService from '#services/standing_service'
import { inject } from '@adonisjs/core'

@inject()
export default class StandingAdjustmentService {
  constructor(
    private auditService: AuditService = new AuditService(),
    private standingService: StandingService = new StandingService()
  ) {}

  /**
   * round_robin stages also have a precomputed `standings` row (used by the
   * league/team detail endpoints) that isn't recomputed on read like the
   * stage-standings endpoint — nudge it now so a deduction shows up
   * immediately, not just after the next game score update.
   */
  private async syncLegacyStanding(stage: Stage, teamId: number) {
    if (stage.stageType !== 'round_robin') {
      return
    }
    await this.standingService.recalculate(stage.seasonId, teamId)
  }

  async list(stageId: number) {
    await this.assertTableStage(stageId)
    return StandingAdjustment.query().where('stage_id', stageId).orderBy('id', 'asc')
  }

  async create(
    stageId: number,
    input: {
      teamId: number
      pointsDelta: number
      reason: string
      stageGroupId?: number | null
      createdBy?: number | null
    },
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const stage = await this.assertTableStage(stageId)
    this.assertDelta(input.pointsDelta)
    await this.assertTeamInSeasonLeague(stage.seasonId, input.teamId)

    const adjustment = await StandingAdjustment.create({
      stageId,
      stageGroupId: input.stageGroupId ?? null,
      teamId: input.teamId,
      pointsDelta: input.pointsDelta,
      reason: input.reason,
      createdBy: input.createdBy ?? null,
    })

    await this.syncLegacyStanding(stage, input.teamId)

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_adjustment.created',
        entityType: 'standing_adjustment',
        entityId: adjustment.id,
        metadata: {
          stageId,
          teamId: input.teamId,
          pointsDelta: input.pointsDelta,
          reason: input.reason,
          stageGroupId: input.stageGroupId ?? null,
        },
        ipAddress: audit.ipAddress,
      })
    }

    return adjustment
  }

  async update(
    adjustmentId: number,
    input: {
      pointsDelta?: number
      reason?: string
      stageGroupId?: number | null
    },
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const adjustment = await StandingAdjustment.findOrFail(adjustmentId)
    const stage = await this.assertTableStage(adjustment.stageId)

    if (input.pointsDelta !== undefined) {
      this.assertDelta(input.pointsDelta)
      adjustment.pointsDelta = input.pointsDelta
    }
    if (input.reason !== undefined) {
      adjustment.reason = input.reason
    }
    if (input.stageGroupId !== undefined) {
      adjustment.stageGroupId = input.stageGroupId
    }
    await adjustment.save()

    await this.syncLegacyStanding(stage, adjustment.teamId)

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_adjustment.updated',
        entityType: 'standing_adjustment',
        entityId: adjustment.id,
        metadata: {
          stageId: adjustment.stageId,
          teamId: adjustment.teamId,
          pointsDelta: adjustment.pointsDelta,
          reason: adjustment.reason,
        },
        ipAddress: audit.ipAddress,
      })
    }

    return adjustment
  }

  async destroy(
    adjustmentId: number,
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const adjustment = await StandingAdjustment.findOrFail(adjustmentId)
    const stage = await this.assertTableStage(adjustment.stageId)
    const snapshot = {
      stageId: adjustment.stageId,
      teamId: adjustment.teamId,
      pointsDelta: adjustment.pointsDelta,
      reason: adjustment.reason,
    }
    await adjustment.delete()

    await this.syncLegacyStanding(stage, snapshot.teamId)

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_adjustment.deleted',
        entityType: 'standing_adjustment',
        entityId: adjustmentId,
        metadata: snapshot,
        ipAddress: audit.ipAddress,
      })
    }
  }

  private assertDelta(delta: number) {
    if (!Number.isInteger(delta) || delta === 0 || delta < -50 || delta > 50) {
      throw new Exception('pointsDelta must be a non-zero integer between -50 and 50', {
        status: 422,
      })
    }
  }

  private async assertTableStage(stageId: number) {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()
    if (stage.stageType === 'knockout' || stage.stageType === 'playoff') {
      throw new Exception('Adjustments are only valid for round_robin and group stages', {
        status: 422,
      })
    }
    return stage
  }

  private async assertTeamInSeasonLeague(seasonId: number, teamId: number) {
    const { default: Season } = await import('#models/season')
    const season = await Season.findOrFail(seasonId)
    const team = await Team.query().where('id', teamId).where('league_id', season.leagueId).first()
    if (!team) {
      throw new Exception('Team is not in this league', { status: 422 })
    }
  }
}
