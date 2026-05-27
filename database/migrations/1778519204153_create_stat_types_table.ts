import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

export default class extends BaseSchema {
  protected tableName = 'stat_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('display_name').notNullable()
      table.string('icon_name').nullable()
      table.enum('category', ['performance', 'discipline', 'substitution']).defaultTo('performance')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.defer(async (db) => {
      const now = DateTime.utc().toSQL({ includeOffset: false }) ?? DateTime.utc().toISO()

      await db.table(this.tableName).insert([
        {
          name: 'goals',
          display_name: 'Goals',
          icon_name: 'soccer-ball',
          category: 'performance',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'own_goal',
          display_name: 'Own Goal',
          icon_name: 'soccer-ball-own',
          category: 'performance',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'assists',
          display_name: 'Assists',
          icon_name: 'handshake',
          category: 'performance',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'yellow_card',
          display_name: 'Yellow Card',
          icon_name: 'square-yellow',
          category: 'discipline',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'red_card',
          display_name: 'Red Card',
          icon_name: 'square-red',
          category: 'discipline',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'saves',
          display_name: 'Saves',
          icon_name: 'glove',
          category: 'performance',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'shots_on_target',
          display_name: 'Shots on Target',
          icon_name: 'target',
          category: 'performance',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'fouls_conceded',
          display_name: 'Fouls Conceded',
          icon_name: 'whistle',
          category: 'discipline',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'substitution_on',
          display_name: 'Substitution On',
          icon_name: 'sub-on',
          category: 'substitution',
          created_at: now,
          updated_at: now,
        },
        {
          name: 'substitution_off',
          display_name: 'Substitution Off',
          icon_name: 'sub-off',
          category: 'substitution',
          created_at: now,
          updated_at: now,
        },
      ])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
