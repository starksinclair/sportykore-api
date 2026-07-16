import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Season from '#models/season'
import Stage from '#models/stage'
import Team from '#models/team'
import type { KnockoutStageConfig, StageStatus } from '#types/stage'

function parseConfig(raw: unknown): KnockoutStageConfig | Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {}
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw as KnockoutStageConfig | Record<string, unknown>
}

export default class StageService {
  async ensureRoundRobinStage(
    seasonId: number,
    client?: TransactionClientContract
  ): Promise<Stage> {
    const options = client ? { client } : undefined
    const existing = await Stage.query(options)
      .where('season_id', seasonId)
      .where('stage_type', 'round_robin')
      .first()

    if (existing) {
      return existing
    }

    const season = await Season.query(options).where('id', seasonId).firstOrFail()
    return Stage.create(
      {
        seasonId,
        name: 'League',
        stageType: 'round_robin',
        sequence: 1,
        status: (season.status === 'active' ? 'active' : 'completed') as StageStatus,
        config: {},
      },
      options
    )
  }

  async listBySeason(seasonId: number): Promise<Stage[]> {
    await Season.findOrFail(seasonId)
    return Stage.query().where('season_id', seasonId).orderBy('sequence', 'asc').orderBy('id', 'asc')
  }

  async createKnockoutStage(
    leagueId: number,
    seasonId: number,
    input: { name: string; sequence?: number; config: KnockoutStageConfig },
    client?: TransactionClientContract
  ): Promise<Stage> {
    const options = client ? { client } : undefined
    const season = await Season.query(options)
      .where('id', seasonId)
      .where('league_id', leagueId)
      .firstOrFail()

    const last = await Stage.query(options)
      .where('season_id', season.id)
      .orderBy('sequence', 'desc')
      .first()
    const nextSequence = input.sequence ?? (last ? last.sequence + 1 : 1)

    return Stage.create(
      {
        seasonId: season.id,
        name: input.name,
        stageType: 'knockout',
        sequence: nextSequence,
        status: 'upcoming',
        config: input.config,
      },
      options
    )
  }

  assertKnockoutTieConfig(config: KnockoutStageConfig) {
    const check = (fmt: { tie_format: string; best_of?: number }, label: string) => {
      if (fmt.tie_format === 'best_of' && (fmt.best_of === undefined || fmt.best_of < 1)) {
        throw new Exception(`${label}: best_of is required when tie_format is best_of`, {
          status: 422,
        })
      }
    }
    check(config.ties.default, 'ties.default')
    if (config.ties.rounds) {
      for (const [round, fmt] of Object.entries(config.ties.rounds)) {
        check(fmt, `ties.rounds.${round}`)
      }
    }
  }

  getKnockoutConfig(stage: Stage): KnockoutStageConfig {
    const config = parseConfig(stage.config) as KnockoutStageConfig
    if (!config.ties?.default?.tie_format) {
      throw new Exception('Knockout stage is missing tie format config', { status: 422 })
    }
    return {
      format: {
        starting_round: config.format?.starting_round,
        has_third_place: config.format?.has_third_place ?? false,
      },
      ties: {
        default: config.ties.default,
        rounds: config.ties.rounds ?? {},
      },
    }
  }

  async assertTeamsInLeague(
    leagueId: number,
    teamIds: number[],
    client?: TransactionClientContract
  ) {
    const options = client ? { client } : undefined
    const teams = await Team.query(options).where('league_id', leagueId).whereIn('id', teamIds)
    if (teams.length !== new Set(teamIds).size) {
      throw new Exception('One or more teams are not in this league', { status: 422 })
    }
  }
}
