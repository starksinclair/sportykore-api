import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'idempotency_keys'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('key_hash', 64).notNullable().unique()
      table.string('request_hash', 64).notNullable()
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()
      table.string('method', 10).notNullable()
      table.string('path', 500).notNullable()
      table.enu('status', ['processing', 'completed']).notNullable().defaultTo('processing')
      table.integer('response_status').nullable()
      table.json('response_body').nullable()
      table.json('response_headers').nullable()
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'method', 'path'])
      table.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
