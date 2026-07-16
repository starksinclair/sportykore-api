import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'

import Season from '#models/season'
import Stage from '#models/stage'
import StageTeam from '#models/stage_team'
import Tie from '#models/tie'
import { nextPow2, nextRound, roundFromSize, roundSize } from '#lib/bracket_rounds'
import StageService from '#services/stage_service'
import TieResolver from '#services/tie_resolver'
import type { BracketRound, KnockoutStageConfig, ProgressionRound } from '#types/stage'
import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

@inject()
export default class BracketService {
  constructor(
    private stageService: StageService,
    private tieResolver: TieResolver
  ) {}

  async getBracket(stageId: number) {
    const stage = await Stage.findOrFail(stageId)
    const ties = await Tie.query()
      .where('stage_id', stageId)
      .preload('homeTeam')
      .preload('awayTeam')
      .preload('winnerTeam')
      .preload('games', (gamesQuery) => {
        gamesQuery
          .preload('homeTeam')
          .preload('awayTeam')
          .preload('winnerTeam')
          .orderBy('leg', 'asc')
      })
      .orderBy('round', 'asc')
      .orderBy('bracket_position', 'asc')

    return { stage, ties }
  }

  async generateKnockoutPhase(stageId: number, seededTeamIds: number[]) {
    if (seededTeamIds.length < 2) {
      throw new Exception('At least 2 teams are required to seed a knockout', { status: 422 })
    }

    const unique = new Set(seededTeamIds)
    if (unique.size !== seededTeamIds.length) {
      throw new Exception('Seeded teams must be unique', { status: 422 })
    }

    // Validate stage + teams before opening a transaction — SQLite pool size is 1,
    // so non-trx queries inside an open transaction will deadlock.
    const stagePeek = await Stage.findOrFail(stageId)
    if (stagePeek.stageType !== 'knockout') {
      throw new Exception('Stage is not a knockout stage', { status: 422 })
    }
    const seasonPeek = await Season.findOrFail(stagePeek.seasonId)
    await this.stageService.assertTeamsInLeague(seasonPeek.leagueId, seededTeamIds)

    return db.transaction(async (trx) => {
      const stage = await Stage.query({ client: trx }).where('id', stageId).firstOrFail()
      if (stage.stageType !== 'knockout') {
        throw new Exception('Stage is not a knockout stage', { status: 422 })
      }

      const existingTies = await Tie.query({ client: trx }).where('stage_id', stage.id).first()
      if (existingTies) {
        throw new Exception('Knockout stage has already been seeded', { status: 409 })
      }

      const season = await Season.query({ client: trx }).where('id', stage.seasonId).firstOrFail()

      const config = this.stageService.getKnockoutConfig(stage)
      const n = seededTeamIds.length
      const bracketSize = nextPow2(n)
      const byes = bracketSize - n
      let entryRound: ProgressionRound = roundFromSize(bracketSize)

      if (config.format.starting_round && config.format.starting_round !== 'third_place') {
        const requested = config.format.starting_round as ProgressionRound
        const requestedSize = roundSize(requested)
        if (requestedSize < n) {
          throw new Exception('starting_round is too small for the seeded team count', {
            status: 422,
          })
        }
        if (requestedSize !== bracketSize) {
          throw new Exception(
            `starting_round ${requested} (size ${requestedSize}) does not match bracket size ${bracketSize}`,
            { status: 422 }
          )
        }
        entryRound = requested
      }

      for (const [index, teamId] of seededTeamIds.entries()) {
        await StageTeam.create(
          {
            stageId: stage.id,
            teamId,
            seed: index + 1,
          },
          { client: trx }
        )
      }

      const entryTies = bracketSize / 2
      const byeSeeds = seededTeamIds.slice(0, byes)
      const remaining = seededTeamIds.slice(byes)

      let position = 1
      for (const teamId of byeSeeds) {
        await Tie.create(
          {
            stageId: stage.id,
            round: entryRound,
            bracketPosition: position,
            homeTeamId: teamId,
            awayTeamId: null,
            isBye: true,
            winnerTeamId: teamId,
            status: 'completed',
            tieFormat: 'single',
            bestOf: null,
            targetWins: null,
            awayGoals: false,
            homeScoreAgg: null,
            awayScoreAgg: null,
          },
          { client: trx }
        )
        position++
      }

      for (let i = 0; i < remaining.length; i += 2) {
        const homeTeamId = remaining[i]
        const awayTeamId = remaining[i + 1]
        if (!awayTeamId) {
          throw new Exception('Odd number of remaining teams after bye assignment', { status: 500 })
        }

        const format = this.tieResolver.resolveFormatForRound(config, entryRound)
        const tie = new Tie()
        tie.useTransaction(trx)
        tie.stageId = stage.id
        tie.round = entryRound
        tie.bracketPosition = position
        tie.homeTeamId = homeTeamId
        tie.awayTeamId = awayTeamId
        tie.isBye = false
        tie.status = 'pending'
        this.tieResolver.applyFormatFields(tie, format)
        await tie.save()

        await this.tieResolver.createTieGames(tie, season, stage, trx)
        position++
      }

      if (position - 1 !== entryTies) {
        throw new Exception(`Expected ${entryTies} entry ties, created ${position - 1}`, {
          status: 500,
        })
      }

      stage.status = 'active'
      stage.useTransaction(trx)
      await stage.save()

      return stage
    })
  }

  async generateNextRound(stageId: number, completedRound: BracketRound) {
    if (completedRound === 'third_place') {
      throw new Exception('Cannot progress from third_place', { status: 422 })
    }

    return db.transaction(async (trx) => {
      const stage = await Stage.query({ client: trx }).where('id', stageId).firstOrFail()
      if (stage.stageType !== 'knockout') {
        throw new Exception('Stage is not a knockout stage', { status: 422 })
      }

      const config = this.stageService.getKnockoutConfig(stage)
      const season = await Season.query({ client: trx }).where('id', stage.seasonId).firstOrFail()

      if (completedRound === 'final') {
        await this.maybeCompleteStage(stage, config, trx)
        return stage
      }

      const next = nextRound(completedRound)

      const existingNext = await Tie.query({ client: trx })
        .where('stage_id', stage.id)
        .where('round', next)
        .first()
      if (existingNext) {
        return stage // idempotent no-op
      }

      const completedTies = await Tie.query({ client: trx })
        .where('stage_id', stage.id)
        .where('round', completedRound)
        .orderBy('bracket_position', 'asc')

      if (completedTies.length === 0) {
        throw new Exception(`No ties found for round ${completedRound}`, { status: 422 })
      }

      for (const tie of completedTies) {
        if (tie.status !== 'completed' || !tie.winnerTeamId) {
          throw new Exception(`All ${completedRound} ties must be completed before advancing`, {
            status: 422,
          })
        }
      }

      const format = this.tieResolver.resolveFormatForRound(config, next)

      for (let i = 0; i < completedTies.length; i += 2) {
        const a = completedTies[i]
        const b = completedTies[i + 1]
        if (!b) {
          throw new Exception('Odd number of completed ties; cannot pair winners', { status: 500 })
        }

        const tie = new Tie()
        tie.useTransaction(trx)
        tie.stageId = stage.id
        tie.round = next
        tie.bracketPosition = Math.floor(i / 2) + 1
        tie.homeTeamId = a.winnerTeamId
        tie.awayTeamId = b.winnerTeamId
        tie.isBye = false
        tie.status = 'pending'
        this.tieResolver.applyFormatFields(tie, format)
        await tie.save()
        await this.tieResolver.createTieGames(tie, season, stage, trx)
      }

      if (completedRound === 'sf' && config.format.has_third_place) {
        const existingThird = await Tie.query({ client: trx })
          .where('stage_id', stage.id)
          .where('round', 'third_place')
          .first()

        if (!existingThird) {
          const losers = completedTies.map((tie) =>
            tie.winnerTeamId === tie.homeTeamId ? tie.awayTeamId : tie.homeTeamId
          )
          if (losers.length === 2 && losers[0] && losers[1]) {
            const thirdFormat = this.tieResolver.resolveFormatForRound(config, 'third_place')
            const third = new Tie()
            third.useTransaction(trx)
            third.stageId = stage.id
            third.round = 'third_place'
            third.bracketPosition = 1
            third.homeTeamId = losers[0]
            third.awayTeamId = losers[1]
            third.isBye = false
            third.status = 'pending'
            this.tieResolver.applyFormatFields(third, thirdFormat)
            await third.save()
            await this.tieResolver.createTieGames(third, season, stage, trx)
          }
        }
      }

      await this.maybeCompleteStage(stage, config, trx)
      return stage
    })
  }

  private async maybeCompleteStage(
    stage: Stage,
    config: KnockoutStageConfig,
    trx: TransactionClientContract
  ) {
    const finalTie = await Tie.query({ client: trx })
      .where('stage_id', stage.id)
      .where('round', 'final')
      .first()

    if (!finalTie || finalTie.status !== 'completed') {
      return
    }

    if (config.format.has_third_place) {
      const third = await Tie.query({ client: trx })
        .where('stage_id', stage.id)
        .where('round', 'third_place')
        .first()
      if (!third || third.status !== 'completed') {
        return
      }
    }

    stage.status = 'completed'
    stage.useTransaction(trx)
    await stage.save()
  }
}
