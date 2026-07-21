import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'

import Stage from '#models/stage'
import StageService from '#services/stage_service'
import BracketService from '#services/bracket_service'
import GroupStageService from '#services/group_stage_service'
import StageStandingService from '#services/stage_standing_service'
import QualifierService from '#services/qualifier_service'
import StageTransformer from '#transformers/stage_transformer'
import TieTransformer from '#transformers/tie_transformer'
import {
  assignGroupTeamsValidator,
  createGroupStageValidator,
  createKnockoutStageValidator,
  generateKnockoutFromGroupValidator,
  nextRoundValidator,
  seedKnockoutStageValidator,
} from '#validators/stage'
import type { KnockoutStageConfig } from '#types/stage'
import { BRACKET_ROUNDS } from '#types/stage'

@inject()
export default class StagesController {
  constructor(
    protected stageService: StageService,
    protected bracketService: BracketService,
    protected groupStageService: GroupStageService,
    protected stageStandingService: StageStandingService,
    protected qualifierService: QualifierService
  ) {}

  async store({ params, request, response, auth }: HttpContext) {
    const stageType = request.input('stageType') ?? 'knockout'
    const leagueId = Number(params.leagueId)
    const actorId = auth.user?.id ?? null
    const ipAddress = request.ip()

    if (stageType === 'group') {
      const data = await request.validateUsing(createGroupStageValidator)
      const { stage, groups } = await this.groupStageService.createGroupStage(
        leagueId,
        data.seasonId,
        {
          name: data.name,
          sequence: data.sequence,
          config: data.config,
        },
        undefined,
        { actorId, ipAddress }
      )
      return response.created({
        message: 'Group stage created successfully',
        id: stage.id,
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          sequence: g.sequence,
          stageId: g.stageId,
        })),
      })
    }

    const data = await request.validateUsing(createKnockoutStageValidator)
    const config: KnockoutStageConfig = {
      format: {
        starting_round: data.config.format?.starting_round,
        has_third_place: data.config.format?.has_third_place ?? false,
      },
      ties: data.config.ties,
    }
    this.stageService.assertKnockoutTieConfig(config)

    const stage = await this.stageService.createKnockoutStage(leagueId, data.seasonId, {
      name: data.name,
      sequence: data.sequence,
      config,
    })

    return response.created({ message: 'Knockout stage created successfully', id: stage.id })
  }

  async assignGroups({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(assignGroupTeamsValidator)
    const stageId = Number(params.id)
    const audit = await this.auditFromStage(stageId, request, auth)

    if (data.mode === 'manual') {
      if (!data.assignments || data.assignments.length === 0) {
        throw new Exception('assignments are required when mode is manual', { status: 422 })
      }
      const assignments = await this.groupStageService.assignTeams(
        stageId,
        { mode: 'manual', assignments: data.assignments },
        audit
      )
      return response.ok({ message: 'Teams assigned', assignments })
    }

    if (!data.teamIds || data.teamIds.length < 2) {
      throw new Exception('teamIds are required when mode is auto', { status: 422 })
    }
    const assignments = await this.groupStageService.assignTeams(
      stageId,
      { mode: 'auto', teamIds: data.teamIds, shuffle: data.shuffle },
      audit
    )
    return response.ok({ message: 'Teams assigned', assignments })
  }

  async generateFixtures({ params, response, request, auth }: HttpContext) {
    const stageId = Number(params.id)
    const result = await this.groupStageService.generateGroupFixtures(
      stageId,
      await this.auditFromStage(stageId, request, auth)
    )
    return response.ok({ message: 'Fixtures generated', count: result.count })
  }

  async standings({ params, serialize }: HttpContext) {
    const result = await this.stageStandingService.forStage(Number(params.id))
    return serialize({
      stage: StageTransformer.transform(result.stage),
      tables: result.tables.map((table) => ({
        stageGroupId: table.stageGroupId,
        stageGroupName: table.stageGroupName,
        sequence: table.sequence,
        rows: table.rows,
        staleOverrides: table.staleOverrides.map((o) => ({
          id: o.id,
          teamId: o.teamId,
          manualRank: o.manualRank,
          cohortSignature: o.cohortSignature,
          reason: o.reason,
        })),
      })),
    })
  }

  async qualifiers({ params, request, serialize }: HttpContext) {
    const qs = request.qs()
    const dryRun = qs.dryRun === 'true' || qs.dryRun === true || qs.dryRun === '1'
    const targetRound =
      typeof qs.targetRound === 'string' &&
      (BRACKET_ROUNDS as readonly string[]).includes(qs.targetRound)
        ? (qs.targetRound as (typeof BRACKET_ROUNDS)[number])
        : undefined
    const thirdsMode: 'auto' | 'manual' = qs.thirdsMode === 'manual' ? 'manual' : 'auto'
    const selectedThirds = qs.selectedThirds
      ? String(qs.selectedThirds)
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      : undefined
    const force = qs.force === 'true' || qs.force === true || qs.force === '1'

    const opts: {
      targetRound?: (typeof BRACKET_ROUNDS)[number]
      thirdsMode: 'auto' | 'manual'
      selectedThirds?: number[]
      force: boolean
    } = { targetRound, thirdsMode, selectedThirds, force }

    const result = dryRun
      ? await this.qualifierService.previewKnockout(Number(params.id), opts)
      : await this.qualifierService.resolveQualifiers(
          await Stage.findOrFail(Number(params.id)),
          opts
        )

    return serialize(result)
  }

  async generateKnockout({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(generateKnockoutFromGroupValidator)
    const stageId = Number(params.id)
    const result = await this.qualifierService.generateKnockout(
      stageId,
      {
        targetRound: data.targetRound,
        thirdsMode: data.thirdsMode,
        selectedThirds: data.selectedThirds,
        qualifiers: data.qualifiers,
        name: data.name,
        force: data.force,
        knockout: data.knockout
          ? {
              format: {
                starting_round: data.knockout.format?.starting_round,
                has_third_place: data.knockout.format?.has_third_place ?? false,
              },
              ties: data.knockout.ties,
            }
          : undefined,
      },
      await this.auditFromStage(stageId, request, auth)
    )

    return response.created({
      stage: StageTransformer.transform(result.stage),
      ties: TieTransformer.transform(result.ties)?.depth(4),
      qualifiers: result.qualifiers,
    })
  }

  async seed({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(seedKnockoutStageValidator)
    await this.bracketService.generateKnockoutPhase(Number(params.id), data.seededTeams)
    return response.ok({ message: 'Knockout phase generated successfully' })
  }

  async nextRound({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(nextRoundValidator)
    await this.bracketService.generateNextRound(Number(params.id), data.completedRound)
    return response.ok({ message: 'Next round generated successfully' })
  }

  async bracket({ params, serialize }: HttpContext) {
    const { stage, ties } = await this.bracketService.getBracket(Number(params.id))
    return serialize({
      stage: StageTransformer.transform(stage),
      ties: TieTransformer.transform(ties)?.depth(4),
    })
  }

  async indexBySeason({ params, serialize }: HttpContext) {
    const stages = await this.stageService.listBySeason(Number(params.seasonId))
    return serialize(StageTransformer.transform(stages))
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
