import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'team_admins'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .notNullable()

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
      table.integer('assigned_by').unsigned().references('id').inTable('users').nullable()
      table.timestamp('removed_at').nullable()
      table.unique(['team_id', 'user_id'])
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
