import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export type UserNotificationType = 'league_player_joined'

export default class UserNotification extends BaseModel {
  static table = 'user_notifications'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare type: UserNotificationType

  @column()
  declare title: string

  @column()
  declare body: string

  @column()
  declare route: string | null

  @column()
  declare leagueId: number | null

  @column()
  declare playerId: number | null

  @column()
  declare teamId: number | null

  @column()
  declare data: Record<string, string | number | boolean | null> | null

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
