import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('primary_position', ['goalkeeper', 'defence', 'midfield', 'attack']).nullable()
      table.enum('secondary_position', ['goalkeeper', 'defence', 'midfield', 'attack']).nullable()
      table.enum('preferred_foot', ['left', 'right', 'both']).nullable()
      table.smallint('height_cm').nullable()
      // Stored for future consent/eligibility work — never serialized (transformer returns age only)
      table.date('date_of_birth').nullable()
      table.string('city', 120).nullable()
      table.string('state', 120).nullable()
      table.string('nationality', 120).nullable()
      table.string('social_handle', 120).nullable()
      // Dormant hook for a future guardian-consent flow; blanking behavior is live
      table.enum('visibility', ['active', 'private']).notNullable().defaultTo('active')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('primary_position')
      table.dropColumn('secondary_position')
      table.dropColumn('preferred_foot')
      table.dropColumn('height_cm')
      table.dropColumn('date_of_birth')
      table.dropColumn('city')
      table.dropColumn('state')
      table.dropColumn('nationality')
      table.dropColumn('social_handle')
      table.dropColumn('visibility')
    })
  }
}
