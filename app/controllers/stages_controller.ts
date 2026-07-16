import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import StageService from '#services/stage_service'
import BracketService from '#services/bracket_service'
import StageTransformer from '#transformers/stage_transformer'
import TieTransformer from '#transformers/tie_transformer'
import {
  createKnockoutStageValidator,
  nextRoundValidator,
  seedKnockoutStageValidator,
} from '#validators/stage'
import type { KnockoutStageConfig } from '#types/stage'

@inject()
export default class StagesController {
  constructor(
    protected stageService: StageService,
    protected bracketService: BracketService
  ) {}

  async store({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(createKnockoutStageValidator)
    const config: KnockoutStageConfig = {
      format: {
        starting_round: data.config.format?.starting_round,
        has_third_place: data.config.format?.has_third_place ?? false,
      },
      ties: data.config.ties,
    }
    this.stageService.assertKnockoutTieConfig(config)

    const stage = await this.stageService.createKnockoutStage(
      Number(params.leagueId),
      data.seasonId,
      {
        name: data.name,
        sequence: data.sequence,
        config,
      }
    )

    return response.created({ message: 'Knockout stage created successfully', id: stage.id })
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
}
