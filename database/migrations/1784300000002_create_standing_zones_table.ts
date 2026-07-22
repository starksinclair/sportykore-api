import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'standing_zones'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('stage_id')
        .unsigned()
        .references('id')
        .inTable('stages')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('stage_group_id')
        .unsigned()
        .references('id')
        .inTable('stage_groups')
        .onDelete('CASCADE')
        .nullable()
      table.integer('position_start').notNullable()
      table.integer('position_end').notNullable()
      table
        .enum('zone_type', [
          'promotion',
          'promotion_playoff',
          'playoff',
          'relegation_playoff',
          'relegation',
          'qualified',
        ])
        .notNullable()
      table.string('label', 120).nullable()

      table.index(['stage_id', 'stage_group_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
