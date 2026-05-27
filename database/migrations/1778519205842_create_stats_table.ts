import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('game_id')
        .unsigned()
        .references('id')
        .inTable('games')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('player_id')
        .unsigned()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('season_id')
        .unsigned()
        .references('id')
        .inTable('seasons')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('stat_type_id')
        .unsigned()
        .references('id')
        .inTable('stat_types')
        .onDelete('CASCADE')
        .notNullable()

      // The 'Who Else' (for assists or substitutions)
      table
        .integer('related_player_id')
        .unsigned()
        .references('id')
        .inTable('players')
        .onDelete('SET NULL')
        .nullable()

      table.integer('minute').unsigned().nullable()
      table.boolean('is_stoppage_time').defaultTo(false)

      table.string('value').nullable()
      table.integer('numeric_value').defaultTo(1)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
