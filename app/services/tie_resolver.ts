import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

import Game from '#models/game'
import Season from '#models/season'
import Tie from '#models/tie'
import type Stage from '#models/stage'
import { targetWins } from '#lib/bracket_rounds'
import type { BracketRound, KnockoutStageConfig, TieFormat, TieFormatConfig } from '#types/stage'

function resolveFormat(
  config: KnockoutStageConfig,
  round: BracketRound
): TieFormatConfig {
  return config.ties.rounds?.[round] ?? config.ties.default
}

export default class TieResolver {
  async createTieGames(
    tie: Tie,
    season: Season,
    stage: Stage,
    client?: TransactionClientContract
  ): Promise<Game[]> {
    if (tie.isBye) {
      return []
    }

    if (!tie.homeTeamId || !tie.awayTeamId) {
      throw new Exception('Contested tie requires both teams', { status: 422 })
    }

    const options = client ? { client } : undefined
    const format = tie.tieFormat as TieFormat
    const games: Game[] = []

    if (format === 'single') {
      games.push(
        await this.createLegGame(tie, season, stage, 1, tie.homeTeamId, tie.awayTeamId, options)
      )
    } else if (format === 'two_legged') {
      games.push(
        await this.createLegGame(tie, season, stage, 1, tie.homeTeamId, tie.awayTeamId, options)
      )
      games.push(
        await this.createLegGame(tie, season, stage, 2, tie.awayTeamId, tie.homeTeamId, options)
      )
    } else {
      // best_of: create first game only
      games.push(
        await this.createLegGame(tie, season, stage, 1, tie.homeTeamId, tie.awayTeamId, options)
      )
    }

    if (tie.status === 'pending') {
      tie.status = 'in_progress'
      if (client) {
        tie.useTransaction(client)
      }
      await tie.save()
    }

    return games
  }

  private async createLegGame(
    tie: Tie,
    season: Season,
    stage: Stage,
    leg: number,
    homeTeamId: number,
    awayTeamId: number,
    options?: { client: TransactionClientContract }
  ) {
    return Game.create(
      {
        leagueId: season.leagueId,
        seasonId: season.id,
        stageId: stage.id,
        tieId: tie.id,
        leg,
        round: tie.round,
        bracketPosition: tie.bracketPosition,
        homeTeamId,
        awayTeamId,
        playedAt: DateTime.utc().plus({ minutes: leg }),
        status: 'scheduled',
      },
      options
    )
  }

  /**
   * After a game in the tie reaches full_time: recompute agg scores and resolve or extend.
   */
  async advanceTie(tieId: number, client?: TransactionClientContract): Promise<Tie> {
    const run = async (trx: TransactionClientContract) => {
      const tie = await Tie.query({ client: trx }).where('id', tieId).firstOrFail()
      if (tie.isBye || tie.status === 'completed') {
        return tie
      }

      const games = await Game.query({ client: trx })
        .where('tie_id', tie.id)
        .orderBy('leg', 'asc')

      const format = tie.tieFormat as TieFormat

      if (format === 'single') {
        const game = games[0]
        if (!game || game.status !== 'full_time') {
          return tie
        }
        if (!game.winnerTeamId) {
          throw new Exception('Knockout game needs a winner before the tie can complete', {
            status: 422,
          })
        }
        tie.homeScoreAgg = game.homeScore
        tie.awayScoreAgg = game.awayScore
        tie.winnerTeamId = game.winnerTeamId
        tie.status = 'completed'
        await tie.useTransaction(trx).save()
        return tie
      }

      if (format === 'two_legged') {
        return this.advanceTwoLegged(tie, games, trx)
      }

      return this.advanceBestOf(tie, games, trx)
    }

    if (client) {
      return run(client)
    }
    return db.transaction(run)
  }

  private async advanceTwoLegged(
    tie: Tie,
    games: Game[],
    trx: TransactionClientContract
  ): Promise<Tie> {
    const fullTimeGames = games.filter((g) => g.status === 'full_time')
    if (fullTimeGames.length < 2) {
      tie.status = 'in_progress'
      await tie.useTransaction(trx).save()
      return tie
    }

    // Aggregate goals relative to tie home/away (not per-leg venue home)
    let homeAgg = 0
    let awayAgg = 0
    for (const game of fullTimeGames) {
      const homeIsTieHome = game.homeTeamId === tie.homeTeamId
      const hs = game.homeScore ?? 0
      const as = game.awayScore ?? 0
      if (homeIsTieHome) {
        homeAgg += hs
        awayAgg += as
      } else {
        homeAgg += as
        awayAgg += hs
      }
    }

    tie.homeScoreAgg = homeAgg
    tie.awayScoreAgg = awayAgg

    if (homeAgg !== awayAgg) {
      tie.winnerTeamId = homeAgg > awayAgg ? tie.homeTeamId : tie.awayTeamId
      tie.status = 'completed'
      await tie.useTransaction(trx).save()
      return tie
    }

    if (tie.awayGoals) {
      // Away goals: goals scored by home team away + away team away
      let homeAwayGoals = 0
      let awayAwayGoals = 0
      for (const game of fullTimeGames) {
        const hs = game.homeScore ?? 0
        const as = game.awayScore ?? 0
        if (game.homeTeamId === tie.homeTeamId) {
          // leg 1: home plays at home — away team's goals are away goals for away side
          awayAwayGoals += as
        } else {
          // leg 2: home team is away — home team's away goals
          homeAwayGoals += as
        }
      }
      if (homeAwayGoals !== awayAwayGoals) {
        tie.winnerTeamId = homeAwayGoals > awayAwayGoals ? tie.homeTeamId : tie.awayTeamId
        tie.status = 'completed'
        await tie.useTransaction(trx).save()
        return tie
      }
    }

    // Level after aggregate (+ away goals): 2nd leg winner (penalties) decides
    const secondLeg = fullTimeGames.find((g) => g.leg === 2) ?? fullTimeGames[1]
    if (!secondLeg.winnerTeamId) {
      throw new Exception('Tied aggregate requires a second-leg winner (penalties)', {
        status: 422,
      })
    }
    tie.winnerTeamId = secondLeg.winnerTeamId
    tie.status = 'completed'
    await tie.useTransaction(trx).save()
    return tie
  }

  private async advanceBestOf(
    tie: Tie,
    games: Game[],
    trx: TransactionClientContract
  ): Promise<Tie> {
    const bestOf = tie.bestOf ?? 1
    const needed = tie.targetWins ?? targetWins(bestOf)
    const stage = await Game.query({ client: trx }).where('tie_id', tie.id).first()
    // load stage/season from any game on the tie
    let season: Season | null = null
    let stageModel: Stage | null = null
    if (stage) {
      season = await Season.query({ client: trx }).where('id', stage.seasonId).first()
      const StageModel = (await import('#models/stage')).default
      stageModel = await StageModel.query({ client: trx }).where('id', stage.stageId!).first()
    }

    let homeWins = 0
    let awayWins = 0
    const fullTime = games.filter((g) => g.status === 'full_time')
    for (const game of fullTime) {
      if (!game.winnerTeamId) {
        continue
      }
      if (game.winnerTeamId === tie.homeTeamId) {
        homeWins++
      } else if (game.winnerTeamId === tie.awayTeamId) {
        awayWins++
      }
    }

    tie.homeScoreAgg = homeWins
    tie.awayScoreAgg = awayWins
    tie.status = 'in_progress'

    if (homeWins >= needed || awayWins >= needed) {
      tie.winnerTeamId = homeWins >= needed ? tie.homeTeamId : tie.awayTeamId
      tie.status = 'completed'
      await tie.useTransaction(trx).save()
      return tie
    }

    const lastLeg = games.reduce((max, g) => Math.max(max, g.leg ?? 0), 0)
    if (lastLeg < bestOf && season && stageModel && tie.homeTeamId && tie.awayTeamId) {
      const nextLeg = lastLeg + 1
      const exists = games.some((g) => g.leg === nextLeg)
      if (!exists) {
        // Alternate home for subsequent legs
        const homeFirst = nextLeg % 2 === 1
        await this.createLegGame(
          tie,
          season,
          stageModel,
          nextLeg,
          homeFirst ? tie.homeTeamId : tie.awayTeamId,
          homeFirst ? tie.awayTeamId : tie.homeTeamId,
          { client: trx }
        )
      }
      await tie.useTransaction(trx).save()
      return tie
    }

    // Even-N safeguard: all games played and still tied on wins
    if (fullTime.length >= bestOf && homeWins === awayWins) {
      let homeGoals = 0
      let awayGoals = 0
      for (const game of fullTime) {
        const homeIsTieHome = game.homeTeamId === tie.homeTeamId
        const hs = game.homeScore ?? 0
        const as = game.awayScore ?? 0
        if (homeIsTieHome) {
          homeGoals += hs
          awayGoals += as
        } else {
          homeGoals += as
          awayGoals += hs
        }
      }
      if (homeGoals !== awayGoals) {
        tie.winnerTeamId = homeGoals > awayGoals ? tie.homeTeamId : tie.awayTeamId
        tie.status = 'completed'
        await tie.useTransaction(trx).save()
        return tie
      }
      const lastGame = fullTime[fullTime.length - 1]
      if (!lastGame.winnerTeamId) {
        throw new Exception('Even best-of series requires a decisive final-game winner', {
          status: 422,
        })
      }
      tie.winnerTeamId = lastGame.winnerTeamId
      tie.status = 'completed'
      await tie.useTransaction(trx).save()
      return tie
    }

    await tie.useTransaction(trx).save()
    return tie
  }

  applyFormatFields(tieData: Partial<Tie>, format: TieFormatConfig) {
    tieData.tieFormat = format.tie_format
    if (format.tie_format === 'best_of') {
      const n = format.best_of ?? 3
      tieData.bestOf = n
      tieData.targetWins = targetWins(n)
      tieData.awayGoals = false
    } else if (format.tie_format === 'two_legged') {
      tieData.bestOf = null
      tieData.targetWins = null
      tieData.awayGoals = format.away_goals ?? false
    } else {
      tieData.bestOf = null
      tieData.targetWins = null
      tieData.awayGoals = false
    }
  }

  resolveFormatForRound(config: KnockoutStageConfig, round: BracketRound): TieFormatConfig {
    return resolveFormat(config, round)
  }
}
