import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stage_teams'

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
      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .notNullable()
        .onDelete('CASCADE')
      table
        .integer('stage_group_id')
        .unsigned()
        .references('id')
        .inTable('stage_groups')
        .nullable()
        .onDelete('SET NULL')
      table.integer('seed').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['stage_id', 'team_id'])
      table.index(['stage_id', 'stage_group_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
