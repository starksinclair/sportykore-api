import Game from '#models/game'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import Season from '#models/season'
import Standing from '#models/standing'
import StatType from '#models/stat_type'
import Team from '#models/team'

import type { TeamLeagueDetail } from '#transformers/team_league_detail_transformer'
import type { TeamSeasonDetail } from '#transformers/team_season_detail_transformer'

export type TeamDetailResult = {
  team: Team
  statTypes: StatType[]
  leagues: TeamLeagueDetail[]
}

export class TeamService {
  async getTeamDetail(teamId: number): Promise<TeamDetailResult> {
    const team = await Team.query().where('id', teamId).preload('league').firstOrFail()

    const [teamStandingRows, games, rosterRows, statTypes] = await Promise.all([
      Standing.query().where('team_id', team.id).preload('season'),
      Game.query()
        .where((query) => {
          query.where('home_team_id', team.id).orWhere('away_team_id', team.id)
        })
        .preload('season')
        .preload('homeTeam')
        .preload('awayTeam'),
      LeaguePlayer.query()
        .where('team_id', team.id)
        .preload('season')
        .preload('player', (playerQuery) => {
          playerQuery.preload('stats', (statsQuery) => {
            statsQuery.preload('type').preload('relatedPlayer')
          })
        }),
      StatType.query().orderBy('category').orderBy('display_name'),
    ])

    const seasonMap = new Map<number, Season>()

    for (const standing of teamStandingRows) {
      seasonMap.set(standing.seasonId, standing.season)
    }
    for (const game of games) {
      seasonMap.set(game.seasonId, game.season)
    }
    for (const roster of rosterRows) {
      seasonMap.set(roster.seasonId, roster.season)
    }

    const buckets = new Map<number, TeamSeasonDetail>()

    for (const [seasonId, season] of seasonMap) {
      buckets.set(seasonId, { season, games: [], standings: [], players: [] })
    }

    for (const game of games) {
      const bucket = buckets.get(game.seasonId)
      if (bucket) {
        this.addGame(bucket, game)
      }
    }

    for (const roster of rosterRows) {
      const bucket = buckets.get(roster.seasonId)
      if (bucket) {
        this.addPlayer(bucket, roster)
      }
    }

    const seasonIds = [...seasonMap.keys()]

    if (seasonIds.length > 0) {
      const fullStandings = await Standing.query()
        .where('league_id', team.leagueId)
        .whereIn('season_id', seasonIds)
        .preload('team')
        .orderBy('points', 'desc')
        .orderBy('goal_difference', 'desc')

      const standingsBySeasonId = new Map<number, Standing[]>()
      for (const standing of fullStandings) {
        if (!standingsBySeasonId.has(standing.seasonId)) {
          standingsBySeasonId.set(standing.seasonId, [])
        }
        standingsBySeasonId.get(standing.seasonId)!.push(standing)
      }

      for (const seasonId of seasonIds) {
        buckets.get(seasonId)!.standings = standingsBySeasonId.get(seasonId) ?? []
      }
    }

    const seasons = [...buckets.values()].sort((a, b) => this.compareSeasons(a.season, b.season))

    for (const season of seasons) {
      season.games.sort((a, b) => this.comparePlayedAt(a.playedAt, b.playedAt))
    }

    const leagues: TeamLeagueDetail[] = [
      {
        league: team.league,
        seasons,
      },
    ]

    return { team, statTypes, leagues }
  }

  private addGame(bucket: TeamSeasonDetail, game: Game) {
    if (!bucket.games.some((row) => row.id === game.id)) {
      bucket.games.push(game)
    }
  }

  private addPlayer(bucket: TeamSeasonDetail, roster: LeaguePlayer) {
    const player = roster.player
    if (bucket.players.some((row) => row.id === player.id)) {
      return
    }

    const seasonStats = player.stats?.filter((stat) => stat.seasonId === roster.seasonId) ?? []
    player.$setRelated('stats', seasonStats)
    player.$extras.position = roster.position
    bucket.players.push(player)
  }

  private compareSeasons(a: Season, b: Season) {
    const rank = (status: string) => {
      if (status === 'active') {
        return 0
      }
      if (status === 'completed') {
        return 1
      }
      return 2
    }

    const byStatus = rank(a.status) - rank(b.status)
    if (byStatus !== 0) {
      return byStatus
    }

    const aCreated = a.createdAt?.toMillis() ?? 0
    const bCreated = b.createdAt?.toMillis() ?? 0
    return bCreated - aCreated
  }

  private comparePlayedAt(a: Game['playedAt'], b: Game['playedAt']): number {
    const aMs = a?.toMillis() ?? 0
    const bMs = b?.toMillis() ?? 0
    return aMs - bMs
  }
}
