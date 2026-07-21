import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('actor_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()
      table.string('action', 80).notNullable()
      table.string('entity_type', 60).notNullable()
      table.bigInteger('entity_id').nullable()
      table.json('metadata').notNullable().defaultTo('{}')
      table.string('ip_address', 64).nullable()

      table.index(['league_id', 'created_at'])
      table.index(['entity_type', 'entity_id'])

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
