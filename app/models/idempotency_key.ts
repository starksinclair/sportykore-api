import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type IdempotencyStatus = 'processing' | 'completed'

export default class IdempotencyKey extends BaseModel {
  static table = 'idempotency_keys'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare keyHash: string

  @column()
  declare requestHash: string

  @column()
  declare userId: number | null

  @column()
  declare method: string

  @column()
  declare path: string

  @column()
  declare status: IdempotencyStatus

  @column()
  declare responseStatus: number | null

  @column()
  declare responseBody: unknown | null

  @column()
  declare responseHeaders: Record<string, unknown> | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
