import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'leagues'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('country_id')
        .unsigned()
        .references('id')
        .inTable('countries')
        .nullable()
        .onDelete('RESTRICT')
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .notNullable()
        .onDelete('SET NULL')
      table.string('name').notNullable()
      table.string('logo_url').nullable()
      table.string('description').nullable()
      table.string('gender').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
