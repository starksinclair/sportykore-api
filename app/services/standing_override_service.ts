import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'

import Stage from '#models/stage'
import StandingOverride from '#models/standing_override'
import AuditService from '#services/audit_service'
import { cohortSignature } from '#services/standings/compute_table'
import StageStandingService from './stage_standing_service.js'

@inject()
export default class StandingOverrideService {
  constructor(
    private stageStandingService: StageStandingService = new StageStandingService(),
    private auditService: AuditService = new AuditService()
  ) {}

  /**
   * Replace overrides for a tied cohort. Payload must cover the full cohort with ranks 1..N.
   */
  async setCohort(
    stageId: number,
    input: {
      stageGroupId?: number | null
      reason?: string | null
      createdBy?: number | null
      ranks: Array<{ teamId: number; manualRank: number }>
    },
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    await this.assertTableStage(stageId)
    const stageGroupId = input.stageGroupId ?? null

    if (input.ranks.length < 2) {
      throw new Exception('Override cohort must include at least 2 teams', { status: 422 })
    }

    const ranks = [...input.ranks].sort((a, b) => a.manualRank - b.manualRank)
    const expectedRanks = ranks.map((_, i) => i + 1)
    if (ranks.some((r, i) => r.manualRank !== expectedRanks[i])) {
      throw new Exception('manualRank must be a contiguous 1..N permutation', { status: 422 })
    }

    const teamIds = ranks.map((r) => r.teamId)
    if (new Set(teamIds).size !== teamIds.length) {
      throw new Exception('Duplicate teamId in override payload', { status: 422 })
    }

    const table = await this.stageStandingService.rawTableRows(stageId, stageGroupId)
    const cohortRows = table.filter((row) => teamIds.includes(row.teamId))
    if (cohortRows.length !== teamIds.length) {
      throw new Exception('One or more teams are not in this standings table', { status: 422 })
    }

    const points = cohortRows[0]!.points
    const played = cohortRows[0]!.played
    if (cohortRows.some((row) => row.points !== points || row.played !== played)) {
      throw new Exception('All teams in an override must be tied on points and games played', {
        status: 422,
      })
    }

    const fullCohort = table.filter((row) => row.points === points && row.played === played)
    if (fullCohort.length !== teamIds.length) {
      throw new Exception('Override payload must cover the entire tied cohort', { status: 422 })
    }

    const signature = cohortSignature(
      points,
      played,
      fullCohort.map((row) => row.teamId)
    )

    await StandingOverride.query().where('stage_id', stageId).whereIn('team_id', teamIds).delete()

    const created: StandingOverride[] = []
    for (const rank of ranks) {
      created.push(
        await StandingOverride.create({
          stageId,
          stageGroupId,
          teamId: rank.teamId,
          manualRank: rank.manualRank,
          cohortSignature: signature,
          reason: input.reason ?? null,
          createdBy: input.createdBy ?? null,
        })
      )
    }

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_override.created',
        entityType: 'standing_override',
        entityId: created[0]?.id ?? null,
        metadata: {
          stageId,
          stageGroupId,
          cohortSignature: signature,
          reason: input.reason ?? null,
          ranks: ranks.map((r) => ({ teamId: r.teamId, manualRank: r.manualRank })),
        },
        ipAddress: audit.ipAddress,
      })
    }

    return created
  }

  async destroy(
    stageId: number,
    overrideId: number,
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const override = await StandingOverride.query()
      .where('id', overrideId)
      .where('stage_id', stageId)
      .firstOrFail()

    const snapshot = {
      stageId: override.stageId,
      teamId: override.teamId,
      manualRank: override.manualRank,
      cohortSignature: override.cohortSignature,
    }
    await override.delete()

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'standing_override.deleted',
        entityType: 'standing_override',
        entityId: overrideId,
        metadata: snapshot,
        ipAddress: audit.ipAddress,
      })
    }
  }

  private async assertTableStage(stageId: number) {
    const stage = await Stage.findOrFail(stageId)
    if (stage.stageType === 'knockout' || stage.stageType === 'playoff') {
      throw new Exception('Overrides are only valid for round_robin and group stages', {
        status: 422,
      })
    }
    return stage
  }
}
