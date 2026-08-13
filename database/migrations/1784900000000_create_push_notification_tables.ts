import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('user_push_tokens', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()
      table.string('provider', 32).notNullable().defaultTo('expo')
      table.string('token', 255).notNullable()
      table.string('platform', 32).nullable()
      table.string('device_id', 128).nullable()
      table.timestamp('last_seen_at').notNullable()
      table.timestamp('disabled_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['provider', 'token'])
      table.index(['user_id', 'disabled_at'])
    })

    this.schema.createTable('league_notification_preferences', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .onDelete('CASCADE')
        .notNullable()
      table.boolean('enabled').notNullable().defaultTo(false)
      table.boolean('kickoff_enabled').notNullable().defaultTo(true)
      table.boolean('final_score_enabled').notNullable().defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['user_id', 'league_id'])
      table.index(['league_id', 'enabled'])
    })
  }

  async down() {
    this.schema.dropTable('league_notification_preferences')
    this.schema.dropTable('user_push_tokens')
  }
}
