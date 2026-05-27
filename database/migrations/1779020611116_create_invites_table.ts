import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invites'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('token').unique().notNullable()
      table.integer('league_id').unsigned().references('id').inTable('leagues')
      table
        .integer('season_id')
        .unsigned()
        .references('id')
        .inTable('seasons')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .nullable()
      table.integer('invited_user_id').unsigned().references('id').inTable('users').nullable()
      table.enum('status', ['pending', 'accepted', 'expired']).defaultTo('pending')
      table.timestamp('expires_at').notNullable()
      table.timestamp('accepted_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
