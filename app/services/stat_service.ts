import { Exception } from '@adonisjs/core/exceptions'

import Game from '#models/game'
import LeaguePlayer from '#models/league_player'

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

export default class StatService {
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
      const relatedOnHome = await LeaguePlayer.query()
        .where('player_id', input.relatedPlayerId)
        .where('league_id', input.leagueId)
        .where('season_id', input.seasonId)
        .where('team_id', game.homeTeamId)
        .where('status', 'active')
        .first()

      const relatedOnAway = await LeaguePlayer.query()
        .where('player_id', input.relatedPlayerId)
        .where('league_id', input.leagueId)
        .where('season_id', input.seasonId)
        .where('team_id', game.awayTeamId)
        .where('status', 'active')
        .first()

      if (!relatedOnHome && !relatedOnAway) {
        throw new Exception(
          'Related player must be on the roster for one of the teams in this game',
          { status: 422 }
        )
      }
    }
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
}
