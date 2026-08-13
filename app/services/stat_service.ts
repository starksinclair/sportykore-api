import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import transmit from '@adonisjs/transmit/services/main'

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
  isPenalty?: boolean
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

export type TrackingEventInput = {
  clientEventId: string
  type: 'pass' | 'shot'
  teamId: number
  playerId: number
  minute?: number | null
  isStoppageTime?: boolean
  completed?: boolean
  onTarget?: boolean
}

export type RecordTrackingEventsInput = {
  events: TrackingEventInput[]
}

export type TrackingTeamMetrics = {
  teamId: number
  passesAttempted: number
  passesCompleted: number
  passCompletionPct: number
  possessionPct: number
  shotsAttempted: number
  shotsOnTarget: number
  shotAccuracyPct: number
}

export type MatchTrackingMetrics = {
  possessionTracked: boolean
  teams: {
    home: TrackingTeamMetrics
    away: TrackingTeamMetrics
  }
}

type TrackingAccumulator = {
  passesAttempted: number
  passesCompleted: number
  shotsAttempted: number
  shotsOnTarget: number
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

  async recordTrackingEvents(gameId: number, input: RecordTrackingEventsInput) {
    const game = await Game.findOrFail(gameId)
    const passType = await this.resolveStatType('pass')
    const shotType = await this.resolveStatType('shot')
    const typeIds = {
      pass: passType.id,
      shot: shotType.id,
    }

    const seenClientIds = new Set<string>()
    const uniqueEvents = input.events.filter((event) => {
      if (seenClientIds.has(event.clientEventId)) return false
      seenClientIds.add(event.clientEventId)
      return true
    })

    for (const event of uniqueEvents) {
      this.validateTrackingEventShape(event)

      if (event.teamId !== game.homeTeamId && event.teamId !== game.awayTeamId) {
        throw new Exception('Team must be one of the teams playing in this game', { status: 422 })
      }
    }

    await this.assertPlayersAreTrackable(game, uniqueEvents)

    const existing = await Stat.query()
      .whereIn(
        'client_event_id',
        uniqueEvents.map((event) => event.clientEventId)
      )
      .select('client_event_id')

    const existingIds = new Set(existing.map((stat) => stat.clientEventId).filter(Boolean))
    const rows = uniqueEvents
      .filter((event) => !existingIds.has(event.clientEventId))
      .map((event) => ({
        gameId: game.id,
        leagueId: game.leagueId,
        seasonId: game.seasonId,
        teamId: event.teamId,
        playerId: event.playerId,
        statTypeId: typeIds[event.type],
        minute: event.minute ?? null,
        isStoppageTime: event.isStoppageTime ?? false,
        numericValue: 1,
        clientEventId: event.clientEventId,
        qualifiers:
          event.type === 'pass'
            ? { completed: event.completed === true }
            : { on_target: event.onTarget === true },
      }))

    if (rows.length) {
      await Stat.createMany(rows)
      transmit.broadcast(`games/${game.id}`, {
        type: 'tracking_updated',
        gameId: game.id,
      } as Record<string, string | number | null>)
    }

    return {
      accepted: rows.length,
      skipped: input.events.length - rows.length,
    }
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

    if (input.isPenalty && input.isOwnGoal) {
      throw new Exception('A goal cannot be both a penalty and an own goal', { status: 422 })
    }

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
      stat.isPenalty = Boolean(input.isPenalty)
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
      throw new Exception('Player must be on the active roster for one of the teams in this game', {
        status: 422,
      })
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

  private validateTrackingEventShape(event: TrackingEventInput) {
    if (event.type === 'pass' && typeof event.completed !== 'boolean') {
      throw new Exception('Pass events must define completed', { status: 422 })
    }

    if (event.type === 'shot' && typeof event.onTarget !== 'boolean') {
      throw new Exception('Shot events must define onTarget', { status: 422 })
    }
  }

  private async assertPlayersAreTrackable(game: Game, events: TrackingEventInput[]) {
    if (!events.length) return

    const teamIds = Array.from(new Set(events.map((event) => event.teamId)))
    const lineups = await GameLineup.query()
      .where('game_id', game.id)
      .whereIn('team_id', teamIds)
      .whereIn('status', ['starter', 'substitute'])

    const activeLineupKeys = new Set(lineups.map((lineup) => `${lineup.teamId}:${lineup.playerId}`))
    const teamsWithLineups = new Set(lineups.map((lineup) => lineup.teamId))
    const rosterFallbackEvents = events.filter((event) => !teamsWithLineups.has(event.teamId))

    for (const event of events) {
      if (
        teamsWithLineups.has(event.teamId) &&
        !activeLineupKeys.has(`${event.teamId}:${event.playerId}`)
      ) {
        throw new Exception('Pass and shot tracking can only use players in the submitted lineup', {
          status: 422,
        })
      }
    }

    if (!rosterFallbackEvents.length) return

    const activeRosterRows = await LeaguePlayer.query()
      .where('league_id', game.leagueId)
      .where('season_id', game.seasonId)
      .where('status', 'active')
      .whereIn('team_id', Array.from(new Set(rosterFallbackEvents.map((event) => event.teamId))))
      .whereIn(
        'player_id',
        Array.from(new Set(rosterFallbackEvents.map((event) => event.playerId)))
      )

    const activeRosterKeys = new Set(activeRosterRows.map((row) => `${row.teamId}:${row.playerId}`))

    for (const event of rosterFallbackEvents) {
      if (!activeRosterKeys.has(`${event.teamId}:${event.playerId}`)) {
        throw new Exception(
          'Pass and shot tracking can only use active roster players before lineups are submitted',
          { status: 422 }
        )
      }
    }
  }
}

export function computeMatchTrackingMetrics(
  stats: Stat[] | undefined,
  homeTeamId: number,
  awayTeamId: number
): MatchTrackingMetrics {
  const home = emptyTrackingAccumulator()
  const away = emptyTrackingAccumulator()

  for (const stat of stats ?? []) {
    const team = stat.teamId === homeTeamId ? home : stat.teamId === awayTeamId ? away : null
    if (!team) continue

    const statName = stat.type?.name?.toLowerCase()
    const qualifiers = normalizeQualifiers(stat.qualifiers)

    if (statName === 'pass') {
      team.passesAttempted += 1
      if (qualifiers.completed === true) {
        team.passesCompleted += 1
      }
    }

    if (statName === 'shot') {
      team.shotsAttempted += 1
      if (qualifiers.on_target === true) {
        team.shotsOnTarget += 1
      }
    }
  }

  const totalPasses = home.passesAttempted + away.passesAttempted

  return {
    possessionTracked: totalPasses > 0,
    teams: {
      home: toTrackingMetrics(homeTeamId, home, totalPasses),
      away: toTrackingMetrics(awayTeamId, away, totalPasses),
    },
  }
}

function emptyTrackingAccumulator(): TrackingAccumulator {
  return {
    passesAttempted: 0,
    passesCompleted: 0,
    shotsAttempted: 0,
    shotsOnTarget: 0,
  }
}

function toTrackingMetrics(
  teamId: number,
  metrics: TrackingAccumulator,
  totalPasses: number
): TrackingTeamMetrics {
  return {
    teamId,
    passesAttempted: metrics.passesAttempted,
    passesCompleted: metrics.passesCompleted,
    passCompletionPct: pct(metrics.passesCompleted, metrics.passesAttempted),
    possessionPct: totalPasses > 0 ? pct(metrics.passesAttempted, totalPasses) : 0,
    shotsAttempted: metrics.shotsAttempted,
    shotsOnTarget: metrics.shotsOnTarget,
    shotAccuracyPct: pct(metrics.shotsOnTarget, metrics.shotsAttempted),
  }
}

function pct(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function normalizeQualifiers(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}
