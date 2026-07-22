import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'standing_adjustments'

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
      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .notNullable()
      table.integer('points_delta').notNullable()
      table.string('reason', 255).notNullable()
      table
        .integer('created_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      table.index(['stage_id', 'stage_group_id', 'team_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
