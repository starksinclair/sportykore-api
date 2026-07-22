import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'

import db from '@adonisjs/lucid/services/db'
import Game from '#models/game'
import Stage from '#models/stage'
import StageGroup from '#models/stage_group'
import type { BracketRound, KnockoutStageConfig, ProgressionRound } from '#types/stage'
import { nextPow2, roundSize } from '#lib/bracket_rounds'
import StageStandingService, { type EnrichedTableRow } from '#services/stage_standing_service'
import GroupStageService from '#services/group_stage_service'
import StageService from '#services/stage_service'
import BracketService from '#services/bracket_service'
import AuditService from '#services/audit_service'
import { compareTableRows } from '#services/standings/compute_table'

export type ResolveQualifiersOpts = {
  targetRound?: BracketRound
  thirdsMode?: 'auto' | 'manual'
  selectedThirds?: number[]
  force?: boolean
  /** When true, do not refuse on incomplete games (preview/dry-run). */
  dryRun?: boolean
}

export type QualifierTeam = {
  teamId: number
  teamName: string
  stageGroupId: number
  stageGroupName: string
  position: number
  points: number
  goalDifference: number
  goalsFor: number
  played: number
  tier: 'automatic' | 'third'
}

export type ResolveQualifiersResult = {
  automatic: QualifierTeam[]
  thirdsCandidates: QualifierTeam[]
  thirdsSelected: QualifierTeam[]
  thirdsNeeded: number
  byes: number
  bracketSize: number
  qualifiers: QualifierTeam[]
  qualifierTeamIds: number[]
  proposedPairings: Array<{ homeTeamId: number; awayTeamId: number }>
  outstandingGameIds: number[]
  warning?: string
}

@inject()
export default class QualifierService {
  constructor(
    private stageStandingService: StageStandingService = new StageStandingService(),
    private groupStageService: GroupStageService = new GroupStageService(),
    private stageService: StageService = new StageService(),
    private auditService: AuditService = new AuditService()
  ) {}

  async resolveQualifiers(
    stage: Stage,
    opts: ResolveQualifiersOpts = {}
  ): Promise<ResolveQualifiersResult> {
    if (stage.stageType !== 'group') {
      throw new Exception('Qualifiers are only available for group stages', { status: 422 })
    }

    const config = this.groupStageService.getGroupConfig(stage)
    const perGroup = config.advancement.per_group
    const groupCount = config.format.group_count
    const automaticCount = groupCount * perGroup

    const outstanding = await Game.query()
      .where('stage_id', stage.id)
      .whereNot('status', 'full_time')
      .select('id')
    const outstandingGameIds = outstanding.map((g) => g.id)

    if (outstandingGameIds.length > 0 && !opts.force && !opts.dryRun) {
      throw new Exception(
        `Group stage has ${outstandingGameIds.length} incomplete game(s); pass force=true to proceed`,
        { status: 422 }
      )
    }

    const standings = await this.stageStandingService.forStage(stage.id)
    const groups = await StageGroup.query()
      .where('stage_id', stage.id)
      .orderBy('sequence', 'asc')
      .orderBy('id', 'asc')

    const groupById = new Map(groups.map((g) => [g.id, g]))
    const automatic: QualifierTeam[] = []
    const thirdsCandidates: QualifierTeam[] = []

    for (const table of standings.tables) {
      if (table.stageGroupId === null) {
        continue
      }
      const group = groupById.get(table.stageGroupId)
      for (const row of table.rows) {
        if (row.position <= perGroup) {
          automatic.push(this.toQualifier(row, table.stageGroupId, group?.name ?? '?', 'automatic'))
        } else if (row.position === perGroup + 1) {
          thirdsCandidates.push(
            this.toQualifier(row, table.stageGroupId, group?.name ?? '?', 'third')
          )
        }
      }
    }

    // Rank automatic qualifiers: winners among themselves, then runners-up, etc. by position then fixed sort
    automatic.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position
      }
      return compareTableRows(a, b)
    })

    thirdsCandidates.sort((a, b) => compareTableRows(a, b))

    let thirdsNeeded = 0
    let bracketSize = nextPow2(Math.max(2, automaticCount))
    let byes = bracketSize - automaticCount

    if (opts.targetRound && opts.targetRound !== 'third_place') {
      const size = roundSize(opts.targetRound)
      if (size < automaticCount) {
        throw new Exception(
          `targetRound ${opts.targetRound} (size ${size}) is smaller than automatic qualifiers (${automaticCount})`,
          { status: 422 }
        )
      }
      if (size > automaticCount + groupCount) {
        throw new Exception(
          `targetRound ${opts.targetRound} requires more than one thirds tier (max ${automaticCount + groupCount})`,
          { status: 422 }
        )
      }
      bracketSize = size
      thirdsNeeded = Math.max(0, size - automaticCount)
      byes = Math.max(0, bracketSize - (automaticCount + thirdsNeeded))
    }

    let thirdsSelected: QualifierTeam[] = []
    if (thirdsNeeded > 0) {
      const mode = opts.thirdsMode ?? 'auto'
      if (mode === 'manual') {
        const selected = opts.selectedThirds ?? []
        if (selected.length !== thirdsNeeded) {
          throw new Exception(
            `thirdsMode=manual requires exactly ${thirdsNeeded} selectedThirds`,
            { status: 422 }
          )
        }
        const byId = new Map(thirdsCandidates.map((t) => [t.teamId, t]))
        thirdsSelected = selected.map((teamId) => {
          const row = byId.get(teamId)
          if (!row) {
            throw new Exception(`Team ${teamId} is not an eligible third-placed team`, {
              status: 422,
            })
          }
          return row
        })
      } else {
        thirdsSelected = thirdsCandidates.slice(0, thirdsNeeded)
      }
    }

    const qualifiers = [...automatic, ...thirdsSelected]
    // Recalculate byes from actual qualifier count
    const actualBracket = opts.targetRound && opts.targetRound !== 'third_place'
      ? bracketSize
      : nextPow2(Math.max(2, qualifiers.length))
    byes = actualBracket - qualifiers.length

    const proposedPairings = this.proposePairings(qualifiers.map((q) => q.teamId), actualBracket)

    return {
      automatic,
      thirdsCandidates,
      thirdsSelected,
      thirdsNeeded,
      byes,
      bracketSize: actualBracket,
      qualifiers,
      qualifierTeamIds: qualifiers.map((q) => q.teamId),
      proposedPairings,
      outstandingGameIds,
      warning:
        outstandingGameIds.length > 0
          ? `${outstandingGameIds.length} incomplete game(s) ignored due to force`
          : undefined,
    }
  }

  async previewKnockout(
    stageId: number,
    opts: ResolveQualifiersOpts = {}
  ): Promise<ResolveQualifiersResult> {
    const stage = await Stage.findOrFail(stageId)
    return this.resolveQualifiers(stage, { ...opts, dryRun: true })
  }

  async generateKnockout(
    stageId: number,
    input: ResolveQualifiersOpts & {
      name?: string
      qualifiers?: number[]
      knockout?: KnockoutStageConfig
    },
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()
    if (stage.stageType !== 'group') {
      throw new Exception('generate-knockout requires a group stage', { status: 422 })
    }

    const preview = await this.resolveQualifiers(stage, input)
    const seededTeamIds =
      input.qualifiers && input.qualifiers.length >= 2
        ? input.qualifiers
        : preview.qualifierTeamIds

    if (seededTeamIds.length < 2) {
      throw new Exception('At least 2 qualifiers are required', { status: 422 })
    }

    const knockoutConfig: KnockoutStageConfig = input.knockout ?? {
      format: {
        starting_round: input.targetRound as ProgressionRound | undefined,
        has_third_place: false,
      },
      ties: { default: { tie_format: 'single' } },
    }

    if (input.targetRound && input.targetRound !== 'third_place') {
      knockoutConfig.format = {
        ...knockoutConfig.format,
        starting_round: input.targetRound as ProgressionRound,
      }
    }

    this.stageService.assertKnockoutTieConfig(knockoutConfig)

    const { default: TieResolver } = await import('#services/tie_resolver')
    const bracketService = new BracketService(this.stageService, new TieResolver())

    const result = await db.transaction(async (trx) => {
      const knockout = await Stage.create(
        {
          seasonId: stage.seasonId,
          name: input.name ?? 'Knockout',
          stageType: 'knockout',
          sequence: stage.sequence + 1,
          status: 'upcoming',
          sourceStageId: stage.id,
          config: knockoutConfig,
        },
        { client: trx }
      )

      // generateKnockoutPhase opens its own transaction — call after this trx commits
      return { knockout }
    })

    await bracketService.generateKnockoutPhase(result.knockout.id, seededTeamIds)

    stage.status = 'completed'
    await stage.save()
    await result.knockout.refresh()

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'group_stage.generate_knockout',
        entityType: 'stage',
        entityId: result.knockout.id,
        metadata: {
          sourceStageId: stageId,
          qualifiers: seededTeamIds,
          clientEdited: Array.isArray(input.qualifiers),
          targetRound: input.targetRound ?? null,
          force: Boolean(input.force),
          outstandingGameIds: preview.outstandingGameIds,
        },
        ipAddress: audit.ipAddress,
      })
    }

    const bracket = await bracketService.getBracket(result.knockout.id)
    return {
      stage: bracket.stage,
      ties: bracket.ties,
      qualifiers: seededTeamIds,
      preview,
    }
  }

  private toQualifier(
    row: EnrichedTableRow,
    stageGroupId: number,
    stageGroupName: string,
    tier: 'automatic' | 'third'
  ): QualifierTeam {
    return {
      teamId: row.teamId,
      teamName: row.teamName,
      stageGroupId,
      stageGroupName,
      position: row.position,
      points: row.points,
      goalDifference: row.goalDifference,
      goalsFor: row.goalsFor,
      played: row.played,
      tier,
    }
  }

  /**
   * Standard bracket pairing for seeded list: 1 vs N, 2 vs N-1, …
   * (proposal only — organizer may edit before generate).
   */
  private proposePairings(
    seededTeamIds: number[],
    bracketSize: number
  ): Array<{ homeTeamId: number; awayTeamId: number }> {
    const slots: Array<number | null> = [...seededTeamIds]
    while (slots.length < bracketSize) {
      slots.push(null) // bye
    }

    const pairings: Array<{ homeTeamId: number; awayTeamId: number }> = []
    const half = bracketSize / 2
    for (let i = 0; i < half; i++) {
      const home = slots[i]
      const away = slots[bracketSize - 1 - i]
      if (home !== null && away !== null) {
        pairings.push({ homeTeamId: home, awayTeamId: away })
      } else if (home !== null && away === null) {
        // bye — omit from pairings list (advances automatically)
      } else if (home === null && away !== null) {
        pairings.push({ homeTeamId: away, awayTeamId: away }) // shouldn't happen with top-seed byes
      }
    }
    return pairings.filter((p) => p.homeTeamId !== p.awayTeamId)
  }
}
