import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'game_lineups'

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
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('formation_id')
        .unsigned()
        .references('id')
        .inTable('formations')
        .onDelete('SET NULL')
        .nullable()
      table.string('slot_key').nullable()
      table
        .enum('status', ['starter', 'substitute', 'did_not_play'])
        .defaultTo('starter')
      table
        .enum('position', [
          'GK',
          'CB',
          'LB',
          'RB',
          'LWB',
          'RWB',
          'CDM',
          'CM',
          'CAM',
          'LM',
          'RM',
          'LW',
          'RW',
          'CF',
          'ST',
          'SS',
        ])
        .nullable()
      table.integer('jersey_number').unsigned().nullable()
      table.integer('starting_order').unsigned().nullable()
      table.integer('subbed_in_minute').unsigned().nullable()
      table.integer('subbed_out_minute').unsigned().nullable()

      table.unique(['game_id', 'player_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
