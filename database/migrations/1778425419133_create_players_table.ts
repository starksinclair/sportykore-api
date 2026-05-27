import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name')
      table.string('avatar_url').nullable()
      table.string('bio').nullable()
      table
        .integer('added_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .nullable()
        .onDelete('SET NULL')
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .notNullable()
        .onDelete('SET NULL')
        .unique()
      table
        .integer('country_id')
        .unsigned()
        .references('id')
        .inTable('countries')
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
