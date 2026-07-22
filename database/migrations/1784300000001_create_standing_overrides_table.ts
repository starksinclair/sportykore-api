import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'standing_overrides'

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
      table.integer('manual_rank').notNullable()
      table.string('cohort_signature', 255).notNullable()
      table.text('reason').nullable()
      table
        .integer('created_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()

      // One group per team per stage — unique without stage_group_id avoids SQLite NULL uniqueness issues
      table.unique(['stage_id', 'team_id'])
      table.index(['stage_id', 'stage_group_id', 'cohort_signature'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
