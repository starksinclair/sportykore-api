import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'venues'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .notNullable()
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.string('address', 500).nullable()
      table.decimal('latitude', 10, 7).nullable()
      table.decimal('longitude', 10, 7).nullable()
      table.string('google_place_id', 255).nullable()
      table.integer('capacity').unsigned().nullable()
      table.string('city', 120).nullable()
      table.text('notes').nullable()
      table
        .integer('created_by')
        .unsigned()
        .references('id')
        .inTable('users')
        .nullable()
        .onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['league_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
