import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'games'

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
        .integer('home_team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('away_team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .notNullable()

      table.integer('home_score').unsigned().nullable()
      table.integer('away_score').unsigned().nullable()
      table.timestamp('played_at').notNullable()
      table.integer('current_minute').unsigned().defaultTo(0)
      table
        .enum('status', ['scheduled', 'live', 'break', 'completed', 'postponed', 'cancelled'])
        .defaultTo('scheduled')

      table.string('venue_name').nullable()

      table.check('?? <> ??', ['home_team_id', 'away_team_id'])
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
