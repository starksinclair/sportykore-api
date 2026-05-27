import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'standings'

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

      table.integer('position').unsigned().defaultTo(0)
      table.integer('played').unsigned().defaultTo(0)
      table.integer('wins').unsigned().defaultTo(0)
      table.integer('draws').unsigned().defaultTo(0)
      table.integer('losses').unsigned().defaultTo(0)
      table.integer('goals_for').unsigned().defaultTo(0)
      table.integer('goals_against').unsigned().defaultTo(0)
      table.integer('goal_difference').defaultTo(0)
      table.integer('points').unsigned().defaultTo(0)
      table.string('form').nullable() // e.g "W,W,L,D,W"

      // prevent duplicate standings entry per team per season
      table.unique(['season_id', 'team_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
