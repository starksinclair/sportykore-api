import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'teams'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name')
      table.string('logo_url').nullable()
      table
        .integer('added_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .notNullable()
        .onDelete('SET NULL')
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .notNullable()
        .onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
