import { Exception } from '@adonisjs/core/exceptions'

import Game from '#models/game'
import Season from '#models/season'
import Stage from '#models/stage'
import StageGroup from '#models/stage_group'
import StageTeam from '#models/stage_team'
import StandingAdjustment from '#models/standing_adjustment'
import StandingOverride from '#models/standing_override'
import StandingZone from '#models/standing_zone'
import Team from '#models/team'
import {
  cohortSignature,
  computeTable,
  type TableRow,
  type TeamMeta,
} from '#services/standings/compute_table'
import { STANDING_GAME_STATUSES } from '#types/game_status'
import type { ZoneType } from '#types/standing'

export type StandingTeamRef = { id: number; name: string; logoUrl: string | null }

export type EnrichedTableRow = TableRow & {
  team: StandingTeamRef
  adjustmentReasons: string[]
  manuallyAdjusted: boolean
  overrideReason: string | null
  // Key is `type` (not `zoneType`) to match the client's ApiStandingZoneTag.
  zone: { type: ZoneType; label: string | null } | null
}

export type StageStandingTable = {
  stageGroupId: number | null
  stageGroupName: string | null
  sequence: number | null
  rows: EnrichedTableRow[]
  staleOverrides: StandingOverride[]
}

export type StageStandingsResult = {
  stage: Stage
  tables: StageStandingTable[]
}

export default class StageStandingService {
  async forStage(stageId: number): Promise<StageStandingsResult> {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()

    if (stage.stageType === 'knockout' || stage.stageType === 'playoff') {
      throw new Exception('Standings are only available for round_robin and group stages', {
        status: 422,
      })
    }

    const [adjustments, overrides, zones] = await Promise.all([
      StandingAdjustment.query().where('stage_id', stageId),
      StandingOverride.query().where('stage_id', stageId),
      StandingZone.query().where('stage_id', stageId),
    ])

    if (stage.stageType === 'group') {
      const groups = await StageGroup.query()
        .where('stage_id', stageId)
        .orderBy('sequence', 'asc')
        .orderBy('id', 'asc')

      const tables: StageStandingTable[] = []
      for (const group of groups) {
        tables.push(
          await this.buildTable({
            stage,
            stageGroupId: group.id,
            stageGroupName: group.name,
            sequence: group.sequence,
            adjustments,
            overrides,
            zones,
          })
        )
      }
      return { stage, tables }
    }

    // round_robin — single ungrouped table
    const table = await this.buildTable({
      stage,
      stageGroupId: null,
      stageGroupName: null,
      sequence: null,
      adjustments,
      overrides,
      zones,
    })
    return { stage, tables: [table] }
  }

  /**
   * Table after games + adjustments + fixed sort, before overrides/zones.
   * Used by override write validation.
   */
  async rawTableRows(stageId: number, stageGroupId: number | null = null): Promise<TableRow[]> {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()
    if (stage.stageType === 'knockout' || stage.stageType === 'playoff') {
      throw new Exception('Standings are only available for round_robin and group stages', {
        status: 422,
      })
    }

    const adjustments = await StandingAdjustment.query().where('stage_id', stageId)
    return this.computeRawRows(stage, stageGroupId, adjustments)
  }

  private async buildTable(opts: {
    stage: Stage
    stageGroupId: number | null
    stageGroupName: string | null
    sequence: number | null
    adjustments: StandingAdjustment[]
    overrides: StandingOverride[]
    zones: StandingZone[]
  }): Promise<StageStandingTable> {
    const rawRows = await this.computeRawRows(opts.stage, opts.stageGroupId, opts.adjustments)
    const scopedAdjustments = opts.adjustments.filter(
      (a) => a.stageGroupId === opts.stageGroupId || a.stageGroupId === null
    )
    const scopedOverrides = opts.overrides.filter((o) => o.stageGroupId === opts.stageGroupId)
    const scopedZones = opts.zones.filter(
      (z) => z.stageGroupId === opts.stageGroupId || z.stageGroupId === null
    )

    const { rows, staleOverrides } = this.applyOverrides(rawRows, scopedOverrides)
    const enriched = this.enrichRows(rows, scopedAdjustments, scopedZones, scopedOverrides)

    return {
      stageGroupId: opts.stageGroupId,
      stageGroupName: opts.stageGroupName,
      sequence: opts.sequence,
      rows: enriched,
      staleOverrides,
    }
  }

  private async computeRawRows(
    stage: Stage,
    stageGroupId: number | null,
    adjustments: StandingAdjustment[]
  ): Promise<Array<TableRow & { team: StandingTeamRef }>> {
    const teamMeta = await this.resolveTeamMeta(stage, stageGroupId)
    const games = await this.loadGames(stage.id, stageGroupId)
    const scopedAdjustments = adjustments
      .filter((a) => a.stageGroupId === stageGroupId || a.stageGroupId === null)
      .filter((a) => teamMeta.some((t) => t.id === a.teamId))
      .map((a) => ({ teamId: a.teamId, pointsDelta: a.pointsDelta }))

    const rows = computeTable(games, teamMeta, scopedAdjustments)
    const metaById = new Map(teamMeta.map((t) => [t.id, t]))
    // Clients render row.team (name + logo); computeTable only carries id/name.
    return rows.map((row) => ({
      ...row,
      team: {
        id: row.teamId,
        name: row.teamName,
        logoUrl: metaById.get(row.teamId)?.logoUrl ?? null,
      },
    }))
  }

  private async resolveTeamMeta(
    stage: Stage,
    stageGroupId: number | null
  ): Promise<Array<TeamMeta & { logoUrl: string | null }>> {
    if (stage.stageType === 'group') {
      const stageTeams = await StageTeam.query()
        .where('stage_id', stage.id)
        .if(stageGroupId !== null, (q) => q.where('stage_group_id', stageGroupId!))
        .preload('team')

      return stageTeams.filter((st) => st.team).map((st) => ({
        id: st.teamId,
        name: st.team.name ?? `Team ${st.teamId}`,
        logoUrl: st.team.logoUrl ?? null,
      }))
    }

    // round_robin: prefer stage_teams; fall back to all league teams
    const stageTeams = await StageTeam.query().where('stage_id', stage.id).preload('team')
    if (stageTeams.length > 0) {
      return stageTeams.filter((st) => st.team).map((st) => ({
        id: st.teamId,
        name: st.team.name ?? `Team ${st.teamId}`,
        logoUrl: st.team.logoUrl ?? null,
      }))
    }

    const season = stage.season ?? (await Season.findOrFail(stage.seasonId))
    const teams = await Team.query().where('league_id', season.leagueId).orderBy('name', 'asc')
    return teams.map((t) => ({
      id: t.id,
      name: t.name ?? `Team ${t.id}`,
      logoUrl: t.logoUrl ?? null,
    }))
  }

  private async loadGames(stageId: number, stageGroupId: number | null) {
    const query = Game.query()
      .where('stage_id', stageId)
      .whereIn('status', [...STANDING_GAME_STATUSES])
      .orderBy('played_at', 'asc')

    if (stageGroupId === null) {
      query.whereNull('stage_group_id')
    } else {
      query.where('stage_group_id', stageGroupId)
    }

    const games = await query
    return games.map((g) => ({
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
    }))
  }

  private applyOverrides<T extends TableRow>(
    rows: T[],
    overrides: StandingOverride[]
  ): { rows: T[]; staleOverrides: StandingOverride[] } {
    if (overrides.length === 0) {
      return { rows, staleOverrides: [] }
    }

    const byTeam = new Map(overrides.map((o) => [o.teamId, o]))
    const staleOverrides: StandingOverride[] = []
    const appliedSignatures = new Set<string>()

    // Build cohorts from current sorted rows
    const cohorts: T[][] = []
    for (const row of rows) {
      const last = cohorts[cohorts.length - 1]
      if (last && last[0]!.points === row.points && last[0]!.played === row.played) {
        last.push(row)
      } else {
        cohorts.push([row])
      }
    }

    const reordered: T[] = []
    for (const cohort of cohorts) {
      if (cohort.length < 2) {
        reordered.push(...cohort)
        continue
      }

      const signature = cohortSignature(
        cohort[0]!.points,
        cohort[0]!.played,
        cohort.map((r) => r.teamId)
      )
      const cohortOverrides = cohort
        .map((r) => byTeam.get(r.teamId))
        .filter((o): o is StandingOverride => !!o)

      const allMatch =
        cohortOverrides.length === cohort.length &&
        cohortOverrides.every((o) => o.cohortSignature === signature)

      if (!allMatch) {
        reordered.push(...cohort)
        continue
      }

      appliedSignatures.add(signature)
      const sorted = [...cohort].sort((a, b) => {
        const rankA = byTeam.get(a.teamId)!.manualRank
        const rankB = byTeam.get(b.teamId)!.manualRank
        return rankA - rankB
      })
      reordered.push(...sorted)
    }

    for (const override of overrides) {
      if (!appliedSignatures.has(override.cohortSignature)) {
        staleOverrides.push(override)
      }
    }

    const withPositions = reordered.map((row, index) => ({
      ...row,
      position: index + 1,
    }))

    return { rows: withPositions, staleOverrides }
  }

  private enrichRows<T extends TableRow>(
    rows: T[],
    adjustments: StandingAdjustment[],
    zones: StandingZone[],
    overrides: StandingOverride[]
  ): Array<
    T & {
      adjustmentReasons: string[]
      manuallyAdjusted: boolean
      overrideReason: string | null
      zone: { type: ZoneType; label: string | null } | null
    }
  > {
    const reasonsByTeam = new Map<number, string[]>()
    for (const adj of adjustments) {
      const list = reasonsByTeam.get(adj.teamId) ?? []
      list.push(adj.reason)
      reasonsByTeam.set(adj.teamId, list)
    }

    const overrideByTeam = new Map(overrides.map((o) => [o.teamId, o]))

    return rows.map((row) => {
      const override = overrideByTeam.get(row.teamId)
      // manuallyAdjusted only if this override was actually applied (not stale)
      // Stale overrides are those whose signature didn't match — check via position reorder
      // We mark manuallyAdjusted when an override exists for the team AND is not in a
      // signature-mismatched state relative to the current cohort.
      const cohortMates = rows.filter((r) => r.points === row.points && r.played === row.played)
      const signature =
        cohortMates.length >= 2
          ? cohortSignature(
              row.points,
              row.played,
              cohortMates.map((r) => r.teamId)
            )
          : null
      const manuallyAdjusted = !!(
        override &&
        signature &&
        override.cohortSignature === signature &&
        cohortMates.length >= 2
      )

      const zone =
        zones.find((z) => row.position >= z.positionStart && row.position <= z.positionEnd) ?? null

      return {
        ...row,
        adjustmentReasons: reasonsByTeam.get(row.teamId) ?? [],
        manuallyAdjusted,
        overrideReason: manuallyAdjusted ? (override?.reason ?? null) : null,
        zone: zone ? { type: zone.zoneType, label: zone.label } : null,
      }
    })
  }
}
