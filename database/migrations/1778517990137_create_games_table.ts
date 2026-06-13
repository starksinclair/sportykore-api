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

      table.integer('first_half_duration').unsigned().notNullable().defaultTo(45)
      table.integer('second_half_duration').unsigned().notNullable().defaultTo(45)
      table.integer('extra_time_duration').unsigned().nullable()

      table.timestamp('first_half_started_at').nullable()
      table.timestamp('second_half_started_at').nullable()
      table.timestamp('extra_time_started_at').nullable()

      table.timestamp('paused_at').nullable()
      table
        .enum('paused_from_status', [
          'first_half',
          'second_half',
          'extra_time',
        ])
        .nullable()

      table
        .enum('status', [
          'scheduled',
          'first_half',
          'half_time',
          'second_half',
          'extra_time',
          'full_time',
          'cancelled',
          'postponed',
          'paused',
        ])
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
