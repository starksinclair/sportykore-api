import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('season_id')
        .unsigned()
        .references('id')
        .inTable('seasons')
        .notNullable()
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table
        .enum('stage_type', ['round_robin', 'group', 'knockout', 'playoff'])
        .notNullable()
      table.integer('sequence').notNullable().defaultTo(1)
      table
        .enum('status', ['upcoming', 'active', 'completed'])
        .notNullable()
        .defaultTo('upcoming')
      table
        .integer('source_stage_id')
        .unsigned()
        .references('id')
        .inTable('stages')
        .nullable()
        .onDelete('SET NULL')
      table.json('config').notNullable().defaultTo('{}')
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['season_id', 'sequence'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
