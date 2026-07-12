import db from '@adonisjs/lucid/services/db'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'

import Formation from '#models/formation'
import Game from '#models/game'
import GameLineup from '#models/game_lineup'
import LeaguePlayer from '#models/league_player'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import type { FormationSlot, LineupPosition, LineupStatus } from '#types/formation'

export type LineupStarterInput = {
  playerId: number
  slotKey: string
  jerseyNumber?: number
}

export type LineupSubstituteInput = {
  playerId: number
  jerseyNumber?: number
}

export type SetLineupInput = {
  teamId: number
  formationId: number
  starters: LineupStarterInput[]
  substitutes: LineupSubstituteInput[]
}

export type UpdateLineupInput = {
  jerseyNumber?: number | null
  slotKey?: string | null
  position?: LineupPosition | null
  status?: LineupStatus
}

export type TeamLineupGroup = {
  team: Team
  formation: Formation | null
  starters: GameLineup[]
  substitutes: GameLineup[]
}

const LOCKED_GAME_STATUSES = ['full_time', 'cancelled'] as const

@inject()
export default class LineupService {
  async setLineup(userId: number, gameId: number, input: SetLineupInput): Promise<GameLineup[]> {
    const game = await this.loadGame(gameId)
    this.assertLineupEditable(game)
    this.assertTeamInGame(game, input.teamId)
    await this.assertCanManageTeam(userId, game, input.teamId)

    const formation = await Formation.findOrFail(input.formationId)
    const slots = this.parseFormationSlots(formation)
    this.validateStartersAgainstFormation(input.starters, slots)

    const playerIds = [
      ...input.starters.map((row) => row.playerId),
      ...input.substitutes.map((row) => row.playerId),
    ]
    this.assertUniquePlayers(playerIds)

    for (const playerId of playerIds) {
      await this.assertActiveRoster(playerId, game, input.teamId)
    }

    return db.transaction(async (trx) => {
      await GameLineup.query({ client: trx })
        .where('game_id', gameId)
        .where('team_id', input.teamId)
        .delete()

      const starterRows = input.starters.map((starter, index) => {
        const slot = slots.find((row) => row.key === starter.slotKey)!
        return {
          gameId,
          teamId: input.teamId,
          playerId: starter.playerId,
          formationId: formation.id,
          slotKey: starter.slotKey,
          position: slot.position,
          status: 'starter' as const,
          jerseyNumber: starter.jerseyNumber ?? null,
          startingOrder: index + 1,
        }
      })

      const substituteRows = input.substitutes.map((substitute) => ({
        gameId,
        teamId: input.teamId,
        playerId: substitute.playerId,
        formationId: formation.id,
        slotKey: null,
        position: null,
        status: 'substitute' as const,
        jerseyNumber: substitute.jerseyNumber ?? null,
        startingOrder: null,
      }))

      return GameLineup.createMany([...starterRows, ...substituteRows], { client: trx })
    })
  }

  async updateLineup(
    userId: number,
    gameId: number,
    lineupId: number,
    patch: UpdateLineupInput
  ): Promise<GameLineup> {
    const game = await this.loadGame(gameId)
    this.assertLineupEditable(game)

    const lineup = await GameLineup.query()
      .where('id', lineupId)
      .where('game_id', gameId)
      .firstOrFail()

    await this.assertCanManageTeam(userId, game, lineup.teamId)

    if (patch.slotKey !== undefined && patch.slotKey !== null && lineup.formationId) {
      const formation = await Formation.findOrFail(lineup.formationId)
      const slots = this.parseFormationSlots(formation)
      const slot = slots.find((row) => row.key === patch.slotKey)

      if (!slot) {
        throw new Exception(`Unknown slot key: ${patch.slotKey}`, { status: 422 })
      }

      const duplicate = await GameLineup.query()
        .where('game_id', gameId)
        .where('team_id', lineup.teamId)
        .where('slot_key', patch.slotKey)
        .whereNot('id', lineup.id)
        .first()

      if (duplicate) {
        throw new Exception(`Slot ${patch.slotKey} is already assigned on this team`, {
          status: 422,
        })
      }

      lineup.slotKey = patch.slotKey
      lineup.position = patch.position ?? slot.position
    } else if (patch.position !== undefined) {
      lineup.position = patch.position
    }

    if (patch.jerseyNumber !== undefined) {
      lineup.jerseyNumber = patch.jerseyNumber
    }

    if (patch.status !== undefined) {
      lineup.status = patch.status
      if (patch.status === 'substitute') {
        lineup.slotKey = null
        lineup.position = null
        lineup.startingOrder = null
      }
    }

    await lineup.save()
    return lineup
  }

  async removePlayer(userId: number, gameId: number, lineupId: number): Promise<void> {
    const game = await this.loadGame(gameId)
    this.assertLineupEditable(game)

    const lineup = await GameLineup.query()
      .where('id', lineupId)
      .where('game_id', gameId)
      .firstOrFail()

    await this.assertCanManageTeam(userId, game, lineup.teamId)
    await lineup.delete()
  }

  async getLineup(gameId: number): Promise<TeamLineupGroup[]> {
    const lineups = await GameLineup.query()
      .where('game_id', gameId)
      .preload('player')
      .preload('team', (teamQuery) => {
        teamQuery.preload('admins', (adminsQuery) => {
          adminsQuery.whereNull('removed_at').preload('user').orderBy('id', 'asc')
        })
      })
      .preload('formation')
      .orderBy('team_id', 'asc')
      .orderBy('starting_order', 'asc')
      .orderBy('id', 'asc')

    return groupLineupsByTeam(lineups)
  }

  private async loadGame(gameId: number) {
    return Game.query()
      .where('id', gameId)
      .preload('league')
      .preload('homeTeam')
      .preload('awayTeam')
      .firstOrFail()
  }

  private assertTeamInGame(game: Game, teamId: number) {
    if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) {
      throw new Exception('Team must be one of the teams playing in this game', { status: 422 })
    }
  }

  private async assertCanManageTeam(userId: number, game: Game, teamId: number) {
    if (game.league.userId === userId) {
      return
    }

    const admin = await TeamAdmin.query()
      .where('team_id', teamId)
      .where('league_id', game.leagueId)
      .where('user_id', userId)
      .whereNull('removed_at')
      .first()

    if (!admin) {
      throw new Exception('You are not authorized to manage this team lineup', { status: 403 })
    }
  }

  private async assertActiveRoster(playerId: number, game: Game, teamId: number) {
    const roster = await LeaguePlayer.query()
      .where('player_id', playerId)
      .where('league_id', game.leagueId)
      .where('season_id', game.seasonId)
      .where('team_id', teamId)
      .where('status', 'active')
      .first()

    if (!roster) {
      throw new Exception('Player is not on the active roster for this team in this season', {
        status: 422,
      })
    }
  }

  private parseFormationSlots(formation: Formation): FormationSlot[] {
    if (typeof formation.slots === 'string') {
      return JSON.parse(formation.slots) as FormationSlot[]
    }

    return formation.slots as FormationSlot[]
  }

  private assertUniquePlayers(playerIds: number[]) {
    const unique = new Set(playerIds)
    if (unique.size !== playerIds.length) {
      throw new Exception('Each player may only appear once in the lineup', { status: 422 })
    }
  }

  private validateStartersAgainstFormation(starters: LineupStarterInput[], slots: FormationSlot[]) {
    if (starters.length !== 11) {
      throw new Exception('Lineup must have exactly 11 starters', { status: 422 })
    }

    const requiredSlots = slots.map((slot) => slot.key)
    const assignedSlots = starters.map((starter) => starter.slotKey)
    const missingSlots = requiredSlots.filter((key) => !assignedSlots.includes(key))

    if (missingSlots.length > 0) {
      throw new Exception(
        `Formation requires these slots to be filled: ${missingSlots.join(', ')}`,
        { status: 422 }
      )
    }

    const unknownSlots = assignedSlots.filter((key) => !requiredSlots.includes(key))
    if (unknownSlots.length > 0) {
      throw new Exception(`Unknown slot keys: ${unknownSlots.join(', ')}`, { status: 422 })
    }
  }

  private assertLineupEditable(game: Game) {
    if (LOCKED_GAME_STATUSES.includes(game.status as (typeof LOCKED_GAME_STATUSES)[number])) {
      throw new Exception('Lineup cannot be changed after the match is finished or cancelled', {
        status: 409,
      })
    }
  }
}

/**
 * Groups flat game_lineup rows by team.
 * Expects `team` (optionally with `admins` + `user` preloaded) and `formation` on each row.
 * The first row for a team supplies the team/formation used on the group.
 */
export function groupLineupsByTeam(lineups: GameLineup[]): TeamLineupGroup[] {
  const byTeam = new Map<number, TeamLineupGroup>()

  for (const row of lineups) {
    let group = byTeam.get(row.teamId)
    if (!group) {
      // console.log('row team admins user', row.team.admins.map((admin) => admin.user))
      group = {
        team: row.team,
        formation: row.formation ?? null,
        starters: [],
        substitutes: [],
      }
      byTeam.set(row.teamId, group)
    }

    if (row.status === 'starter') {
      group.starters.push(row)
    } else {
      group.substitutes.push(row)
    }
  }

  return [...byTeam.values()]
}
