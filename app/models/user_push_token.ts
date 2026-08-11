import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export type PushProvider = 'expo'

export default class UserPushToken extends BaseModel {
  static table = 'user_push_tokens'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare provider: PushProvider

  @column()
  declare token: string

  @column()
  declare platform: string | null

  @column()
  declare deviceId: string | null

  @column.dateTime()
  declare lastSeenAt: DateTime

  @column.dateTime()
  declare disabledAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
