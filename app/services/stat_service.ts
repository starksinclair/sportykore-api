import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'

import Game from '#models/game'
import GameLineup from '#models/game_lineup'
import LeaguePlayer from '#models/league_player'
import Stat from '#models/stat'
import StatType from '#models/stat_type'

export type CreateStatInput = {
  gameId: number
  playerId: number
  leagueId: number
  seasonId: number
  teamId: number
  statTypeId: number
  relatedPlayerId?: number | null
  minute?: number | null
  isStoppageTime?: boolean
  value?: string | null
  numericValue?: number
}

export type AccreditStatInput = {
  playerId: number
  assistPlayerId?: number | null
  isOwnGoal: boolean
  minute: number
}

export type SubstitutionSwapInput = {
  playerOffId: number
  playerOnId: number
  minute: number
  isStoppageTime?: boolean
}

export type RecordSubstitutionInput = {
  gameId: number
  leagueId: number
  seasonId: number
  teamId: number
  substitutions: SubstitutionSwapInput[]
}

export default class StatService {
  async resolveStatType(name: string): Promise<StatType> {
    return StatType.query().where('name', name).firstOrFail()
  }

  async validateForCreate(input: CreateStatInput) {
    const game = await Game.find(input.gameId)

    if (!game) {
      throw new Exception('Game not found', { status: 404 })
    }

    if (game.leagueId !== input.leagueId || game.seasonId !== input.seasonId) {
      throw new Exception('Game does not belong to the given league and season', { status: 422 })
    }

    if (input.teamId !== game.homeTeamId && input.teamId !== game.awayTeamId) {
      throw new Exception('Team must be one of the teams playing in this game', { status: 422 })
    }

    await this.assertActiveRoster({
      playerId: input.playerId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      teamId: input.teamId,
    })

    if (input.relatedPlayerId) {
      await this.assertPlayerInGame({
        playerId: input.relatedPlayerId,
        game,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
      })
    }
  }

  /**
   * Creates paired substitution_off + substitution_on stats in one transaction.
   * Does not mutate game_lineups.
   */
  async recordSubstitutions(input: RecordSubstitutionInput): Promise<Stat[]> {
    const game = await Game.find(input.gameId)

    if (!game) {
      throw new Exception('Game not found', { status: 404 })
    }

    if (game.leagueId !== input.leagueId || game.seasonId !== input.seasonId) {
      throw new Exception('Game does not belong to the given league and season', { status: 422 })
    }

    if (input.teamId !== game.homeTeamId && input.teamId !== game.awayTeamId) {
      throw new Exception('Team must be one of the teams playing in this game', { status: 422 })
    }

    for (const swap of input.substitutions) {
      if (swap.playerOffId === swap.playerOnId) {
        throw new Exception('Substitution players must be different', { status: 422 })
      }

      await this.assertActiveRoster({
        playerId: swap.playerOffId,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamId: input.teamId,
      })
      await this.assertActiveRoster({
        playerId: swap.playerOnId,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamId: input.teamId,
      })

      await this.assertLineupRole({
        gameId: input.gameId,
        teamId: input.teamId,
        playerId: swap.playerOffId,
        status: 'starter',
        label: 'Player coming off',
      })
      await this.assertLineupRole({
        gameId: input.gameId,
        teamId: input.teamId,
        playerId: swap.playerOnId,
        status: 'substitute',
        label: 'Player coming on',
      })
    }

    const playerIds = input.substitutions.flatMap((swap) => [swap.playerOffId, swap.playerOnId])
    if (new Set(playerIds).size !== playerIds.length) {
      throw new Exception('Each player may only appear once across the substitution batch', {
        status: 422,
      })
    }

    const offType = await this.resolveStatType('substitution_off')
    const onType = await this.resolveStatType('substitution_on')

    return db.transaction(async (trx) => {
      const created: Stat[] = []

      for (const swap of input.substitutions) {
        const offStat = await Stat.create(
          {
            gameId: input.gameId,
            leagueId: input.leagueId,
            seasonId: input.seasonId,
            teamId: input.teamId,
            statTypeId: offType.id,
            playerId: swap.playerOffId,
            relatedPlayerId: swap.playerOnId,
            minute: swap.minute,
            isStoppageTime: swap.isStoppageTime ?? false,
            numericValue: 1,
          },
          { client: trx }
        )

        const onStat = await Stat.create(
          {
            gameId: input.gameId,
            leagueId: input.leagueId,
            seasonId: input.seasonId,
            teamId: input.teamId,
            statTypeId: onType.id,
            playerId: swap.playerOnId,
            relatedPlayerId: swap.playerOffId,
            minute: swap.minute,
            isStoppageTime: swap.isStoppageTime ?? false,
            numericValue: 1,
          },
          { client: trx }
        )

        created.push(offStat, onStat)
      }

      return created
    })
  }

  async accreditPlaceholder(stat: Stat, input: AccreditStatInput): Promise<Stat> {
    const game = await Game.findOrFail(stat.gameId)
    const goalType = await this.resolveStatType('goals')
    const ownGoalType = await this.resolveStatType('own_goal')
    const assistType = await this.resolveStatType('assists')

    await this.assertPlayerInGame({
      playerId: input.playerId,
      game,
      leagueId: stat.leagueId,
      seasonId: stat.seasonId,
    })

    if (input.assistPlayerId) {
      if (input.isOwnGoal) {
        throw new Exception('Assists are not allowed on own goals', { status: 422 })
      }

      if (input.assistPlayerId === input.playerId) {
        throw new Exception('Scorer and assist player must be different', { status: 422 })
      }

      await this.assertPlayerInGame({
        playerId: input.assistPlayerId,
        game,
        leagueId: stat.leagueId,
        seasonId: stat.seasonId,
      })
    }

    return db.transaction(async (trx) => {
      stat.useTransaction(trx)
      stat.playerId = input.playerId
      stat.minute = input.minute
      stat.statTypeId = input.isOwnGoal ? ownGoalType.id : goalType.id
      await stat.save()

      if (input.assistPlayerId) {
        const assistTeamId = await this.resolvePlayerTeamId({
          playerId: input.assistPlayerId,
          leagueId: stat.leagueId,
          seasonId: stat.seasonId,
          game,
        })

        await Stat.create(
          {
            gameId: stat.gameId,
            leagueId: stat.leagueId,
            seasonId: stat.seasonId,
            teamId: assistTeamId,
            statTypeId: assistType.id,
            playerId: input.assistPlayerId,
            relatedPlayerId: input.playerId,
            minute: input.minute,
            numericValue: 1,
          },
          { client: trx }
        )
      }

      return stat
    })
  }

  private async assertPlayerInGame(input: {
    playerId: number
    game: Game
    leagueId: number
    seasonId: number
  }) {
    const onHome = await LeaguePlayer.query()
      .where('player_id', input.playerId)
      .where('league_id', input.leagueId)
      .where('season_id', input.seasonId)
      .where('team_id', input.game.homeTeamId)
      .where('status', 'active')
      .first()

    const onAway = await LeaguePlayer.query()
      .where('player_id', input.playerId)
      .where('league_id', input.leagueId)
      .where('season_id', input.seasonId)
      .where('team_id', input.game.awayTeamId)
      .where('status', 'active')
      .first()

    if (!onHome && !onAway) {
      throw new Exception(
        'Player must be on the active roster for one of the teams in this game',
        { status: 422 }
      )
    }
  }

  private async resolvePlayerTeamId(input: {
    playerId: number
    leagueId: number
    seasonId: number
    game: Game
  }): Promise<number> {
    const roster = await LeaguePlayer.query()
      .where('player_id', input.playerId)
      .where('league_id', input.leagueId)
      .where('season_id', input.seasonId)
      .where('status', 'active')
      .whereIn('team_id', [input.game.homeTeamId, input.game.awayTeamId])
      .first()

    if (!roster?.teamId) {
      throw new Exception('Assist player must be on the active roster for this game', {
        status: 422,
      })
    }

    return roster.teamId
  }

  private async assertActiveRoster(input: {
    playerId: number
    leagueId: number
    seasonId: number
    teamId: number
  }) {
    const roster = await LeaguePlayer.query()
      .where('player_id', input.playerId)
      .where('league_id', input.leagueId)
      .where('season_id', input.seasonId)
      .where('team_id', input.teamId)
      .where('status', 'active')
      .first()

    if (!roster) {
      throw new Exception('Player is not on the active roster for this team in this season', {
        status: 422,
      })
    }
  }

  private async assertLineupRole(input: {
    gameId: number
    teamId: number
    playerId: number
    status: 'starter' | 'substitute'
    label: string
  }) {
    const row = await GameLineup.query()
      .where('game_id', input.gameId)
      .where('team_id', input.teamId)
      .where('player_id', input.playerId)
      .first()

    if (!row) {
      throw new Exception(`${input.label} must be in this team's lineup for the game`, {
        status: 422,
      })
    }

    if (row.status !== input.status) {
      const expected = input.status === 'starter' ? 'a starter' : 'on the bench (substitute)'
      throw new Exception(`${input.label} must be ${expected} in the current lineup`, {
        status: 422,
      })
    }
  }
}
