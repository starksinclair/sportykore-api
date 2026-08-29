import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_social_links'

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
      table
        .enu('platform', ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'website'])
        .notNullable()
      table.string('url', 500).notNullable()
      table.string('handle', 160).nullable()

      table.unique(['player_id', 'platform'])
      table.index(['player_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
