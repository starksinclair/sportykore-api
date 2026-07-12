import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

import { formations } from '../data/formations.js'

export default class extends BaseSchema {
  protected tableName = 'formations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable().unique()
      table.string('display_name').notNullable()
      table.json('slots').notNullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at')
    })

    this.defer(async (db) => {
      const now = DateTime.utc().toSQL({ includeOffset: false }) ?? DateTime.utc().toISO()

      await db.table(this.tableName).insert(
        formations.map((row) => ({
          name: row.name,
          display_name: row.displayName,
          slots: JSON.stringify(row.slots),
          is_active: true,
          created_at: now,
        }))
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
