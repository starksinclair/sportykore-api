import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('user_notifications', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()
      table.string('type', 64).notNullable()
      table.string('title', 160).notNullable()
      table.text('body').notNullable()
      table.string('route', 255).nullable()
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .onDelete('CASCADE')
        .nullable()
      table
        .integer('player_id')
        .unsigned()
        .references('id')
        .inTable('players')
        .onDelete('SET NULL')
        .nullable()
      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('SET NULL')
        .nullable()
      table.json('data').nullable()
      table.timestamp('read_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id', 'read_at'])
      table.index(['user_id', 'created_at'])
      table.index(['league_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable('user_notifications')
  }
}
