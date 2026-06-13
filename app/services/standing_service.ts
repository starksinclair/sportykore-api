import Game from '#models/game'
import Standing from '#models/standing'

export default class StandingService {
  async recalculate(seasonId: number, teamId: number) {
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

    // recalculate positions for the whole season after upsert
    await this.recalculatePositions(seasonId)
  }

  async recalculatePositions(seasonId: number) {
    const standings = await Standing.query()
      .where('season_id', seasonId)
      .orderBy('points', 'desc')
      .orderBy('goal_difference', 'desc')
      .orderBy('goals_for', 'desc')

    for (const [i, standing] of standings.entries()) {
      standing.position = i + 1
      await standing.save()
    }
  }
}
