import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'league_players'

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
        .integer('player_id')
        .unsigned()
        .references('id')
        .inTable('players')
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
        .nullable()
      table.string('jersey_number', 5).nullable()
      table
        .enum('status', ['active', 'transferred', 'injured', 'suspended', 'pending', 'inactive'])
        .defaultTo('active')
      table.boolean('is_captain').defaultTo(false)
      table.enum('position', ['attack', 'defence', 'midfield', 'goalkeeper']).nullable()

      table.timestamp('joined_at').defaultTo(this.now())
      table.timestamp('left_at').nullable()

      // Prevents a player from being on the same team twice in one season
      table.unique(['player_id', 'team_id', 'season_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
