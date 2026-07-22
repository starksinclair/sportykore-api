import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ties'

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
        .enum('round', ['r256', 'r128', 'r64', 'r32', 'r16', 'qf', 'sf', 'final', 'third_place'])
        .notNullable()
      table.integer('bracket_position').notNullable()
      table
        .integer('home_team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .nullable()
        .onDelete('SET NULL')
      table
        .integer('away_team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .nullable()
        .onDelete('SET NULL')
      table
        .enum('tie_format', ['single', 'two_legged', 'best_of'])
        .notNullable()
        .defaultTo('single')
      table.smallint('best_of').nullable()
      table.smallint('target_wins').nullable()
      table.boolean('away_goals').notNullable().defaultTo(false)
      table.boolean('is_bye').notNullable().defaultTo(false)
      table.smallint('home_score_agg').nullable()
      table.smallint('away_score_agg').nullable()
      table
        .integer('winner_team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .nullable()
        .onDelete('SET NULL')
      table
        .enum('status', ['pending', 'in_progress', 'completed'])
        .notNullable()
        .defaultTo('pending')
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['stage_id', 'round', 'bracket_position'])
      table.index(['stage_id', 'round', 'bracket_position'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
