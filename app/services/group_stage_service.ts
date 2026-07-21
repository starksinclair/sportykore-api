import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'

import db from '@adonisjs/lucid/services/db'
import Game from '#models/game'
import Season from '#models/season'
import Stage from '#models/stage'
import StageGroup from '#models/stage_group'
import StageTeam from '#models/stage_team'
import StandingZone from '#models/standing_zone'
import Team from '#models/team'
import type { GroupStageConfig, StageStatus } from '#types/stage'
import AuditService from '#services/audit_service'

export type CreateGroupStageInput = {
  name: string
  sequence?: number
  config?: Partial<GroupStageConfig> | GroupStageConfig
}

export type AssignTeamsInput =
  | {
      mode: 'manual'
      assignments: Array<{ teamId: number; stageGroupId: number }>
    }
  | {
      mode: 'auto'
      teamIds: number[]
      shuffle?: boolean
    }

function parseConfig(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {}
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return raw as Record<string, unknown>
}

function defaultGroupConfig(partial?: Partial<GroupStageConfig> | GroupStageConfig): GroupStageConfig {
  return {
    format: {
      group_count: partial?.format?.group_count ?? 2,
      double_round_robin: partial?.format?.double_round_robin ?? false,
    },
    advancement: {
      per_group: partial?.advancement?.per_group ?? 2,
    },
  }
}

/**
 * Circle-method round-robin fixtures. Returns pairs with 0-based matchday index.
 */
export function circleMethodFixtures(
  teamIds: number[]
): Array<{ homeTeamId: number; awayTeamId: number; matchday: number }> {
  if (teamIds.length < 2) {
    return []
  }

  const teams = [...teamIds]
  const bye = -1
  if (teams.length % 2 === 1) {
    teams.push(bye)
  }

  const n = teams.length
  const rounds = n - 1
  const half = n / 2
  const fixtures: Array<{ homeTeamId: number; awayTeamId: number; matchday: number }> = []
  let arr = [...teams]

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = arr[i]!
      const away = arr[n - 1 - i]!
      if (home === bye || away === bye) {
        continue
      }
      // Alternate home/away by round for balance
      if (round % 2 === 0) {
        fixtures.push({ homeTeamId: home, awayTeamId: away, matchday: round })
      } else {
        fixtures.push({ homeTeamId: away, awayTeamId: home, matchday: round })
      }
    }
    const fixed = arr[0]!
    const rest = arr.slice(1)
    const last = rest.pop()!
    arr = [fixed, last, ...rest]
  }

  return fixtures
}

/**
 * Snake-order distribution across groups (row-major with reverse on odd rows).
 */
export function snakeAssign(
  teamIds: number[],
  groupIds: number[]
): Array<{ teamId: number; stageGroupId: number; seed: number }> {
  if (groupIds.length === 0) {
    return []
  }
  return teamIds.map((teamId, index) => {
    const row = Math.floor(index / groupIds.length)
    let col = index % groupIds.length
    if (row % 2 === 1) {
      col = groupIds.length - 1 - col
    }
    return {
      teamId,
      stageGroupId: groupIds[col]!,
      seed: index + 1,
    }
  })
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}

@inject()
export default class GroupStageService {
  constructor(private auditService: AuditService = new AuditService()) {}

  getGroupConfig(stage: Stage): GroupStageConfig {
    const raw = parseConfig(stage.config)
    const format = (raw.format ?? {}) as Record<string, unknown>
    const advancement = (raw.advancement ?? {}) as Record<string, unknown>

    if (raw.ties !== undefined) {
      throw new Exception('Group stage config must not include knockout ties fields', {
        status: 422,
      })
    }

    const groupCount = Number(format.group_count)
    const perGroup = Number(advancement.per_group)
    if (!Number.isFinite(groupCount) || groupCount < 1) {
      throw new Exception('Group stage is missing format.group_count', { status: 422 })
    }
    if (!Number.isFinite(perGroup) || perGroup < 1) {
      throw new Exception('Group stage is missing advancement.per_group', { status: 422 })
    }

    return {
      format: {
        group_count: groupCount,
        double_round_robin: Boolean(format.double_round_robin ?? false),
      },
      advancement: { per_group: perGroup },
    }
  }

  async createGroupStage(
    leagueId: number,
    seasonId: number,
    input: CreateGroupStageInput,
    client?: TransactionClientContract,
    audit?: { actorId?: number | null; ipAddress?: string | null }
  ): Promise<{ stage: Stage; groups: StageGroup[] }> {
    const run = async (trx: TransactionClientContract) => {
      const season = await Season.query({ client: trx })
        .where('id', seasonId)
        .where('league_id', leagueId)
        .firstOrFail()

      const config = defaultGroupConfig(input.config)
      if (config.advancement.per_group < 1 || config.format.group_count < 1) {
        throw new Exception('Invalid group stage config', { status: 422 })
      }

      const last = await Stage.query({ client: trx })
        .where('season_id', season.id)
        .orderBy('sequence', 'desc')
        .first()
      const nextSequence = input.sequence ?? (last ? last.sequence + 1 : 1)

      const stage = await Stage.create(
        {
          seasonId: season.id,
          name: input.name,
          stageType: 'group',
          sequence: nextSequence,
          status: 'upcoming' as StageStatus,
          config,
        },
        { client: trx }
      )

      const groups: StageGroup[] = []
      for (let i = 0; i < config.format.group_count; i++) {
        groups.push(
          await StageGroup.create(
            {
              stageId: stage.id,
              name: String.fromCharCode(65 + i),
              sequence: i + 1,
            },
            { client: trx }
          )
        )
      }

      // One stage-level qualified zone (null stage_group_id applies to all groups)
      await StandingZone.create(
        {
          stageId: stage.id,
          stageGroupId: null,
          positionStart: 1,
          positionEnd: config.advancement.per_group,
          zoneType: 'qualified',
          label: 'Advances to knockout',
        },
        { client: trx }
      )

      return { stage, groups }
    }

    const result = client ? await run(client) : await db.transaction(run)

    if (audit) {
      await this.auditService.log({
        leagueId,
        actorId: audit.actorId,
        action: 'group_stage.created',
        entityType: 'stage',
        entityId: result.stage.id,
        metadata: {
          name: result.stage.name,
          groupCount: result.groups.length,
          config: result.stage.config,
        },
        ipAddress: audit.ipAddress,
      })
    }

    return result
  }

  async assignTeams(
    stageId: number,
    input: AssignTeamsInput,
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()
    if (stage.stageType !== 'group') {
      throw new Exception('Team assignment is only valid for group stages', { status: 422 })
    }

    const existing = await StageTeam.query().where('stage_id', stageId).first()
    if (existing) {
      throw new Exception('Teams are already assigned for this stage', { status: 409 })
    }

    const groups = await StageGroup.query()
      .where('stage_id', stageId)
      .orderBy('sequence', 'asc')
      .orderBy('id', 'asc')
    if (groups.length === 0) {
      throw new Exception('Group stage has no groups', { status: 422 })
    }

    let assignments: Array<{ teamId: number; stageGroupId: number; seed: number }>

    if (input.mode === 'manual') {
      const groupIds = new Set(groups.map((g) => g.id))
      for (const row of input.assignments) {
        if (!groupIds.has(row.stageGroupId)) {
          throw new Exception(`Invalid stageGroupId ${row.stageGroupId}`, { status: 422 })
        }
      }
      const teamIds = input.assignments.map((a) => a.teamId)
      if (new Set(teamIds).size !== teamIds.length) {
        throw new Exception('Duplicate team in assignments', { status: 422 })
      }
      await this.assertTeamsInLeague(stage.season.leagueId, teamIds)
      assignments = input.assignments.map((a, index) => ({
        teamId: a.teamId,
        stageGroupId: a.stageGroupId,
        seed: index + 1,
      }))
    } else {
      const teamIds = [...input.teamIds]
      if (input.shuffle) {
        shuffleInPlace(teamIds)
      }
      await this.assertTeamsInLeague(stage.season.leagueId, teamIds)
      assignments = snakeAssign(
        teamIds,
        groups.map((g) => g.id)
      )
    }

    await db.transaction(async (trx) => {
      for (const row of assignments) {
        await StageTeam.create(
          {
            stageId,
            teamId: row.teamId,
            stageGroupId: row.stageGroupId,
            seed: row.seed,
          },
          { client: trx }
        )
      }
    })

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'group_stage.teams_assigned',
        entityType: 'stage',
        entityId: stageId,
        metadata: {
          mode: input.mode,
          assignments: assignments.map((a) => ({
            teamId: a.teamId,
            stageGroupId: a.stageGroupId,
            seed: a.seed,
          })),
        },
        ipAddress: audit.ipAddress,
      })
    }

    return assignments
  }

  async generateGroupFixtures(
    stageId: number,
    audit?: { leagueId: number; actorId?: number | null; ipAddress?: string | null }
  ) {
    const stage = await Stage.query().where('id', stageId).preload('season').firstOrFail()
    if (stage.stageType !== 'group') {
      throw new Exception('Fixture generation is only valid for group stages', { status: 422 })
    }

    const existingGame = await Game.query().where('stage_id', stageId).first()
    if (existingGame) {
      throw new Exception('Fixtures already exist for this stage', { status: 409 })
    }

    const config = this.getGroupConfig(stage)
    const groups = await StageGroup.query()
      .where('stage_id', stageId)
      .orderBy('sequence', 'asc')
      .orderBy('id', 'asc')

    const season = stage.season
    const leagueId = season.leagueId
    const created: Game[] = []
    let globalIndex = 0

    await db.transaction(async (trx) => {
      for (const group of groups) {
        const stageTeams = await StageTeam.query({ client: trx })
          .where('stage_id', stageId)
          .where('stage_group_id', group.id)
          .orderBy('seed', 'asc')

        const teamIds = stageTeams.map((st) => st.teamId)
        if (teamIds.length < 2) {
          continue
        }

        let fixtures = circleMethodFixtures(teamIds)
        if (config.format.double_round_robin) {
          const roundsPerLeg =
            teamIds.length % 2 === 0 ? teamIds.length - 1 : teamIds.length
          const secondLeg = fixtures.map((f) => ({
            homeTeamId: f.awayTeamId,
            awayTeamId: f.homeTeamId,
            matchday: f.matchday + roundsPerLeg,
          }))
          fixtures = [...fixtures, ...secondLeg]
        }

        for (const fixture of fixtures) {
          const game = await Game.create(
            {
              leagueId,
              seasonId: season.id,
              stageId: stage.id,
              stageGroupId: group.id,
              homeTeamId: fixture.homeTeamId,
              awayTeamId: fixture.awayTeamId,
              status: 'scheduled',
              playedAt: DateTime.utc().plus({ days: fixture.matchday, minutes: globalIndex }),
              tieId: null,
              round: null,
              leg: null,
            },
            { client: trx }
          )
          created.push(game)
          globalIndex++
        }
      }

      stage.useTransaction(trx)
      stage.status = 'active'
      await stage.save()
    })

    if (audit) {
      await this.auditService.log({
        leagueId: audit.leagueId,
        actorId: audit.actorId,
        action: 'group_stage.fixtures_generated',
        entityType: 'stage',
        entityId: stageId,
        metadata: { gameCount: created.length },
        ipAddress: audit.ipAddress,
      })
    }

    return { games: created, count: created.length }
  }

  private async assertTeamsInLeague(leagueId: number, teamIds: number[]) {
    if (teamIds.length === 0) {
      throw new Exception('At least one team is required', { status: 422 })
    }
    const teams = await Team.query().where('league_id', leagueId).whereIn('id', teamIds)
    if (teams.length !== new Set(teamIds).size) {
      throw new Exception('One or more teams are not in this league', { status: 422 })
    }
  }
}
