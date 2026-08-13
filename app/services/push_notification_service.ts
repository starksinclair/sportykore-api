import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

import Game from '#models/game'
import LeagueNotificationPreference from '#models/league_notification_preference'
import UserPushToken from '#models/user_push_token'
import env from '#start/env'

type RegisterPushTokenInput = {
  provider?: 'expo'
  token: string
  platform?: 'ios' | 'android' | 'web' | 'unknown'
  deviceId?: string | null
}

type LeagueNotificationEvent = 'kickoff' | 'final_score'

type ExpoPushMessage = {
  to: string
  title: string
  body: string
  sound: 'default'
  data: Record<string, string | number>
}

type ExpoPushTicket = {
  status?: 'ok' | 'error'
  id?: string
  message?: string
  details?: {
    error?: string
  }
}

export default class PushNotificationService {
  async registerToken(userId: number, input: RegisterPushTokenInput): Promise<UserPushToken> {
    const provider = input.provider ?? 'expo'
    const existing = await UserPushToken.query()
      .where('provider', provider)
      .where('token', input.token)
      .first()

    if (existing) {
      existing.merge({
        userId,
        platform: input.platform ?? existing.platform ?? null,
        deviceId: input.deviceId ?? existing.deviceId ?? null,
        lastSeenAt: DateTime.utc(),
        disabledAt: null,
      })
      await existing.save()
      return existing
    }

    return UserPushToken.create({
      userId,
      provider,
      token: input.token,
      platform: input.platform ?? null,
      deviceId: input.deviceId ?? null,
      lastSeenAt: DateTime.utc(),
      disabledAt: null,
    })
  }

  async getLeaguePreference(userId: number, leagueId: number) {
    const preference = await LeagueNotificationPreference.query()
      .where('user_id', userId)
      .where('league_id', leagueId)
      .first()

    return this.serializePreference(leagueId, preference)
  }

  async setLeaguePreference(userId: number, leagueId: number, enabled: boolean) {
    const preference = await LeagueNotificationPreference.updateOrCreate(
      { userId, leagueId },
      {
        userId,
        leagueId,
        enabled,
        kickoffEnabled: true,
        finalScoreEnabled: true,
      }
    )

    return this.serializePreference(leagueId, preference)
  }

  async notifyKickoff(game: Game): Promise<void> {
    await this.notifyGameEvent(game.id, 'kickoff')
  }

  async notifyFinalScore(game: Game): Promise<void> {
    await this.notifyGameEvent(game.id, 'final_score')
  }

  private async notifyGameEvent(gameId: number, event: LeagueNotificationEvent): Promise<void> {
    const game = await Game.query()
      .where('id', gameId)
      .preload('league')
      .preload('homeTeam')
      .preload('awayTeam')
      .first()

    if (!game) return

    const tokens = await this.tokensForLeagueEvent(game.leagueId, event)
    if (tokens.length === 0) return

    const message = this.buildGameMessage(game, event)
    const messages = tokens.map((token) => ({
      ...message,
      to: token.token,
    }))

    await this.sendExpoMessages(messages)
  }

  private async tokensForLeagueEvent(leagueId: number, event: LeagueNotificationEvent) {
    const eventColumn = event === 'kickoff' ? 'kickoff_enabled' : 'final_score_enabled'

    return UserPushToken.query()
      .join(
        'league_notification_preferences',
        'league_notification_preferences.user_id',
        'user_push_tokens.user_id'
      )
      .where('league_notification_preferences.league_id', leagueId)
      .where('league_notification_preferences.enabled', true)
      .where(`league_notification_preferences.${eventColumn}`, true)
      .where('user_push_tokens.provider', 'expo')
      .whereNull('user_push_tokens.disabled_at')
      .select('user_push_tokens.*')
  }

  private buildGameMessage(
    game: Game,
    event: LeagueNotificationEvent
  ): Omit<ExpoPushMessage, 'to'> {
    const home = game.homeTeam?.name ?? 'Home'
    const away = game.awayTeam?.name ?? 'Away'
    const leagueName = game.league?.name ?? 'SportyKore'

    if (event === 'kickoff') {
      return {
        title: `${home} vs ${away} has kicked off`,
        body: leagueName,
        sound: 'default',
        data: {
          type: 'league_game_event',
          event,
          leagueId: game.leagueId,
          gameId: game.id,
          route: `/match/${game.id}`,
        },
      }
    }

    return {
      title: `Final score: ${home} ${game.homeScore ?? 0} - ${game.awayScore ?? 0} ${away}`,
      body: leagueName,
      sound: 'default',
      data: {
        type: 'league_game_event',
        event,
        leagueId: game.leagueId,
        gameId: game.id,
        route: `/match/${game.id}`,
      },
    }
  }

  private async sendExpoMessages(messages: ExpoPushMessage[]): Promise<void> {
    const chunks = this.chunk(messages, 100)
    for (const chunk of chunks) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
            ...this.expoAccessTokenHeader(),
          },
          body: JSON.stringify(chunk),
        })

        if (!response.ok) {
          logger.warn({ status: response.status }, 'Expo push send failed')
          continue
        }

        const body = (await response.json()) as { data?: ExpoPushTicket[] }
        await this.disableUnregisteredTokens(chunk, body.data ?? [])
      } catch (error) {
        logger.warn({ error }, 'Expo push send failed')
      }
    }
  }

  private async disableUnregisteredTokens(messages: ExpoPushMessage[], tickets: ExpoPushTicket[]) {
    const deadTokens = tickets
      .map((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? messages[index]?.to
          : null
      )
      .filter((token): token is string => Boolean(token))

    if (deadTokens.length === 0) return

    await UserPushToken.query()
      .whereIn('token', deadTokens)
      .where('provider', 'expo')
      .update({ disabledAt: DateTime.utc() })
  }

  private expoAccessTokenHeader(): Record<string, string> {
    const accessToken = env.get('EXPO_PUSH_ACCESS_TOKEN')
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  }

  private serializePreference(leagueId: number, preference: LeagueNotificationPreference | null) {
    return {
      leagueId,
      enabled: preference?.enabled ?? false,
      kickoffEnabled: preference?.kickoffEnabled ?? true,
      finalScoreEnabled: preference?.finalScoreEnabled ?? true,
    }
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size))
    }
    return chunks
  }
}
