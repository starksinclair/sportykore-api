import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_awards'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('game_id')
        .unsigned()
        .references('id')
        .inTable('games')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('player_id')
        .unsigned()
        .references('id')
        .inTable('players')
        .onDelete('SET NULL')
        .nullable()
      table.enu('award_type', ['motm']).notNullable().defaultTo('motm')
      table
        .integer('awarded_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      table.unique(['game_id', 'award_type'])
      table.index(['player_id', 'award_type'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
