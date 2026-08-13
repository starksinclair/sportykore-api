import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class LeagueNotificationPreference extends BaseModel {
  static table = 'league_notification_preferences'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare leagueId: number

  @column()
  declare enabled: boolean

  @column()
  declare kickoffEnabled: boolean

  @column()
  declare finalScoreEnabled: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
