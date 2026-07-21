import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_highlights'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('player_id')
        .unsigned()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
        .notNullable()
      // YouTube video ID only — never a full URL
      table.string('video_id', 20).notNullable()
      table.string('title', 140).nullable()
      table.smallint('sort_order').notNullable().defaultTo(0)

      table.index(['player_id', 'sort_order'])
      table.unique(['player_id', 'video_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
