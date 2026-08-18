import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import transmit from '@adonisjs/transmit/services/main'

import Game from '#models/game'
import League from '#models/league'
import LeagueNotificationPreference from '#models/league_notification_preference'
import Player from '#models/player'
import Team from '#models/team'
import UserNotification from '#models/user_notification'
import UserPushToken from '#models/user_push_token'
import env from '#start/env'

type RegisterPushTokenInput = {
  provider?: 'expo'
  token: string
  platform?: 'ios' | 'android' | 'web' | 'unknown'
  deviceId?: string | null
}

type LeagueNotificationEvent = 'kickoff' | 'final_score'

type AppNotificationInput = {
  userId: number
  type: 'league_player_joined'
  title: string
  body: string
  route?: string | null
  leagueId?: number | null
  playerId?: number | null
  teamId?: number | null
  data?: Record<string, string | number | boolean | null> | null
}

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

  async listUserNotifications(userId: number, limit: number = 50) {
    const normalizedLimit = Math.min(Math.max(Math.floor(limit), 1), 100)
    const [notifications, unreadCount] = await Promise.all([
      UserNotification.query()
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(normalizedLimit),
      this.unreadCount(userId),
    ])

    return {
      notifications: notifications.map((notification) => this.serializeNotification(notification)),
      unreadCount,
    }
  }

  async unreadCount(userId: number): Promise<number> {
    const row = await UserNotification.query()
      .where('user_id', userId)
      .whereNull('read_at')
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async markNotificationRead(userId: number, notificationId: number) {
    const notification = await UserNotification.query()
      .where('id', notificationId)
      .where('user_id', userId)
      .firstOrFail()

    if (!notification.readAt) {
      notification.readAt = DateTime.utc()
      await notification.save()
      await this.broadcastNotificationBadge(userId, 'notification_read', notification.id)
    }

    return this.serializeNotification(notification)
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await UserNotification.query()
      .where('user_id', userId)
      .whereNull('read_at')
      .update({ readAt: DateTime.utc() })
    await this.broadcastNotificationBadge(userId, 'notifications_read_all')
  }

  async notifyLeagueOwnerPlayerJoined(input: {
    leagueId: number
    playerId: number
    teamId?: number | null
  }): Promise<void> {
    const [league, player, team] = await Promise.all([
      League.query().where('id', input.leagueId).first(),
      Player.query().where('id', input.playerId).first(),
      input.teamId ? Team.query().where('id', input.teamId).first() : Promise.resolve(null),
    ])

    if (!league || !player || !league.userId) return
    if (player.userId === league.userId) return

    const playerName = player.name || 'A player'
    const leagueName = league.name || 'your league'
    const teamName = team?.name ?? null
    const title = 'New player joined'
    const body = teamName
      ? `${playerName} joined ${teamName} in ${leagueName}.`
      : `${playerName} joined ${leagueName}.`
    const route = `/manage/${league.id}`
    const data = {
      leagueId: league.id,
      leagueName,
      playerId: player.id,
      playerName,
      teamId: team?.id ?? null,
      teamName,
      route,
    }

    const notification = await this.createAppNotification({
      userId: league.userId,
      type: 'league_player_joined',
      title,
      body,
      route,
      leagueId: league.id,
      playerId: player.id,
      teamId: team?.id ?? null,
      data,
    })

    const tokens = await this.activeExpoTokensForUsers([league.userId])
    if (tokens.length === 0) return

    await this.sendExpoMessages(
      tokens.map((token) => ({
        title,
        body,
        sound: 'default',
        data: {
          type: 'league_player_joined',
          notificationId: notification.id,
          leagueId: league.id,
          playerId: player.id,
          teamId: team?.id ?? 0,
          route,
        },
        to: token.token,
      }))
    )
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

  private async createAppNotification(input: AppNotificationInput) {
    const notification = await UserNotification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      route: input.route ?? null,
      leagueId: input.leagueId ?? null,
      playerId: input.playerId ?? null,
      teamId: input.teamId ?? null,
      data: input.data ?? null,
      readAt: null,
    })

    await this.broadcastNotificationBadge(input.userId, 'notification_created', notification.id)

    return notification
  }

  private async broadcastNotificationBadge(
    userId: number,
    type: 'notification_created' | 'notification_read' | 'notifications_read_all',
    notificationId?: number
  ) {
    try {
      const unreadCount = type === 'notifications_read_all' ? 0 : await this.unreadCount(userId)
      transmit.broadcast(`users/${userId}/notifications`, {
        type,
        notificationId: notificationId ?? null,
        unreadCount,
      } as Record<string, string | number | null>)
    } catch (error) {
      logger.warn({ error, userId, type }, 'Transmit notification badge broadcast failed')
    }
  }

  private async activeExpoTokensForUsers(userIds: number[]) {
    if (userIds.length === 0) return []

    return UserPushToken.query()
      .whereIn('user_id', userIds)
      .where('provider', 'expo')
      .whereNull('disabled_at')
  }

  private serializeNotification(notification: UserNotification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      route: notification.route,
      leagueId: notification.leagueId,
      playerId: notification.playerId,
      teamId: notification.teamId,
      data: notification.data ?? {},
      readAt: notification.readAt?.toISO() ?? null,
      createdAt: notification.createdAt?.toISO() ?? null,
    }
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
