import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Game from '#models/game'
import Standing from '#models/standing'
import Team from '#models/team'

const ZERO_STANDING = {
  position: 0,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
  form: null as string | null,
}

export default class StandingService {
  /**
   * Ensure a zeroed standing row exists for a team in a season (idempotent).
   */
  async ensureForTeam(
    leagueId: number,
    seasonId: number,
    teamId: number,
    client?: TransactionClientContract
  ) {
    const options = client ? { client } : undefined

    await Standing.firstOrCreate(
      { seasonId, teamId },
      { leagueId, ...ZERO_STANDING },
      options
    )
  }

  /**
   * Seed zeroed standing rows for all teams in a season, then assign positions.
   */
  async ensureForTeams(
    leagueId: number,
    seasonId: number,
    teamIds: number[],
    client?: TransactionClientContract
  ) {
    for (const teamId of teamIds) {
      await this.ensureForTeam(leagueId, seasonId, teamId, client)
    }

    await this.recalculatePositions(seasonId, client)
  }

  /**
   * Seed zeroed standing rows for league teams missing from a season table.
   */
  async ensureLeagueTeamsInSeason(leagueId: number, seasonId: number) {
    const teams = await Team.query().where('league_id', leagueId).select('id')
    console.log('teams', JSON.stringify(teams, null, 2))
    if (teams.length === 0) {
      console.log('No teams found for league', { leagueId })
      return
    }

    const teamIds = teams.map((team) => team.id)
    const existingRows = await Standing.query()
      .where('season_id', seasonId)
      .whereIn('team_id', teamIds)
      .select('team_id')

    const existingIds = new Set(existingRows.map((row) => row.teamId))
    const missingIds = teamIds.filter((id) => !existingIds.has(id))

    if (missingIds.length > 0) {
      await this.ensureForTeams(leagueId, seasonId, missingIds)
    }
  }

  async recalculate(seasonId: number, teamId: number) {
    const team = await Team.findOrFail(teamId)

    const games = await Game.query()
      .where('season_id', seasonId)
      .where((q) => q.where('home_team_id', teamId).orWhere('away_team_id', teamId))
      .where('status', 'full_time')

    let played = 0
    let wins = 0
    let draws = 0
    let losses = 0
    let goalsFor = 0
    let goalsAgainst = 0

    for (const game of games) {
      const isHome = game.homeTeamId === teamId
      const homeScore = game.homeScore ?? 0
      const awayScore = game.awayScore ?? 0
      const scored = isHome ? homeScore : awayScore
      const conceded = isHome ? awayScore : homeScore

      played++
      goalsFor += scored
      goalsAgainst += conceded

      if (scored > conceded) wins++
      else if (scored === conceded) draws++
      else losses++
    }

    const points = wins * 3 + draws
    const goalDifference = goalsFor - goalsAgainst

    await Standing.updateOrCreate(
      { seasonId, teamId },
      {
        leagueId: team.leagueId,
        played,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference,
        points,
      }
    )

    await this.recalculatePositions(seasonId)
  }

  async recalculatePositions(seasonId: number, client?: TransactionClientContract) {
    const standings = await Standing.query({ client })
      .where('season_id', seasonId)
      .orderBy('points', 'desc')
      .orderBy('goal_difference', 'desc')
      .orderBy('goals_for', 'desc')

    for (const [i, standing] of standings.entries()) {
      standing.position = i + 1
      if (client) {
        standing.useTransaction(client)
      }
      await standing.save()
    }
  }
}
