import { BaseSchema } from '@adonisjs/lucid/schema'

import { LEAGUE_TIEBREAKERS } from '#types/tiebreaker'

export default class extends BaseSchema {
  protected tableName = 'leagues'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('tiebreaker', [...LEAGUE_TIEBREAKERS])
        .notNullable()
        .defaultTo('goal_difference_goals_scored')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('tiebreaker')
    })
  }
}
