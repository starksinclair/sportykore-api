import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stage_groups'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('stage_id')
        .unsigned()
        .references('id')
        .inTable('stages')
        .notNullable()
        .onDelete('CASCADE')
      table.string('name', 120).notNullable()
      table.integer('sequence').notNullable().defaultTo(1)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['stage_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
