import Game from '#models/game'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import Season from '#models/season'
import Stat from '#models/stat'
import StatType from '#models/stat_type'
import Team from '#models/team'

import type { PlayerLeagueDetail } from '#transformers/player_league_detail_transformer'
import type { PlayerSeasonDetail } from '#transformers/player_season_detail_transformer'

type SeasonBucket = PlayerSeasonDetail

type LeagueGroup = {
  league: League
  seasons: Map<number, SeasonBucket>
}

export type PlayerDetailResult = {
  player: Player
  statTypes: StatType[]
  leagues: PlayerLeagueDetail[]
}

export class PlayerService {
  async getPlayerDetail(id: string | number): Promise<PlayerDetailResult> {
    const player = await Player.query().where('id', id).preload('country').firstOrFail()

    const memberships = await LeaguePlayer.query()
      .where('player_id', player.id)
      .preload('league')
      .preload('season')
      .preload('team')

    const [stats, statTypes, teamGames] = await Promise.all([
      Stat.query()
        .where('player_id', player.id)
        .preload('league')
        .preload('season')
        .preload('type')
        .preload('team')
        .preload('relatedPlayer')
        .preload('game', (gameQuery) => {
          gameQuery.preload('homeTeam').preload('awayTeam')
        }),
      StatType.query().orderBy('category').orderBy('display_name'),
      this.loadTeamGames(memberships),
    ])

    const leagueGroups = new Map<number, LeagueGroup>()

    for (const membership of memberships) {
      const bucket = this.ensureSeasonBucket(
        leagueGroups,
        membership.league,
        membership.season,
        membership.team
      )
      bucket.position = membership.position
    }

    for (const stat of stats) {
      const bucket = this.ensureSeasonBucket(
        leagueGroups,
        stat.league,
        stat.season,
        stat.team ?? null
      )
      bucket.stats.push(stat)
      if (stat.game) {
        this.addGame(bucket, stat.game)
      }
    }

    for (const game of teamGames) {
      const bucket = leagueGroups.get(game.leagueId)?.seasons.get(game.seasonId)
      if (bucket) {
        this.addGame(bucket, game)
      }
    }

    const leagues = [...leagueGroups.values()]
      .map((group) => ({
        league: group.league,
        seasons: [...group.seasons.values()].sort((a, b) => this.compareSeasons(a.season, b.season)),
      }))
      .sort((a, b) => a.league.name.localeCompare(b.league.name))

    for (const league of leagues) {
      for (const season of league.seasons) {
        season.games.sort((a, b) => this.comparePlayedAt(a.playedAt, b.playedAt))
        season.stats.sort((a, b) => this.compareStats(a, b))
      }
    }

    return { player, statTypes, leagues }
  }

  private async loadTeamGames(memberships: LeaguePlayer[]): Promise<Game[]> {
    const uniqueKeys = new Map<string, { leagueId: number; seasonId: number; teamId: number }>()
    for (const row of memberships) {
      if (!row.teamId) {
        continue
      }
      const key = `${row.leagueId}:${row.seasonId}:${row.teamId}`
      uniqueKeys.set(key, {
        leagueId: row.leagueId,
        seasonId: row.seasonId,
        teamId: row.teamId,
      })
    }

    if (uniqueKeys.size === 0) {
      return []
    }

    return Game.query()
      .where((query) => {
        for (const { leagueId, seasonId, teamId } of uniqueKeys.values()) {
          query.orWhere((sub) => {
            sub
              .where('league_id', leagueId)
              .where('season_id', seasonId)
              .where((teamQuery) => {
                teamQuery.where('home_team_id', teamId).orWhere('away_team_id', teamId)
              })
          })
        }
      })
      .preload('homeTeam')
      .preload('awayTeam')
  }

  private ensureSeasonBucket(
    leagueGroups: Map<number, LeagueGroup>,
    league: League,
    season: Season,
    team: Team | null
  ): SeasonBucket {
    let group = leagueGroups.get(league.id)
    if (!group) {
      group = { league, seasons: new Map() }
      leagueGroups.set(league.id, group)
    }

    let bucket = group.seasons.get(season.id)
    if (!bucket) {
      bucket = { season, team, position: null, games: [], stats: [] }
      group.seasons.set(season.id, bucket)
    } else if (team && !bucket.team) {
      bucket.team = team
    }

    return bucket
  }

  private addGame(bucket: SeasonBucket, game: Game) {
    if (!bucket.games.some((row) => row.id === game.id)) {
      bucket.games.push(game)
    }
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

  private comparePlayedAt(
    a: Game['playedAt'],
    b: Game['playedAt']
  ): number {
    const aMs = a?.toMillis() ?? 0
    const bMs = b?.toMillis() ?? 0
    return aMs - bMs
  }

  private compareStats(a: Stat, b: Stat): number {
    const minuteA = a.minute ?? 999
    const minuteB = b.minute ?? 999
    if (minuteA !== minuteB) {
      return minuteA - minuteB
    }
    return a.id - b.id
  }
}
