import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stats'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Marks a `goals` stat as scored from a penalty kick in regular play.
      // Distinct from the knockout-tie penalty shootout (games.home/away_penalty_score).
      table.boolean('is_penalty').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_penalty')
    })
  }
}
