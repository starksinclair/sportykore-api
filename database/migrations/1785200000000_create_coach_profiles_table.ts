import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'coach_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.string('display_name', 255).notNullable()
      table.string('photo_url').nullable()
      table.text('bio').nullable()
      table.text('experience').nullable()
      table.text('qualifications').nullable()
      table.text('philosophy').nullable()
      table.integer('country_id').unsigned().references('id').inTable('countries').onDelete('SET NULL').nullable()
      table.string('city', 120).nullable()
      table.string('state', 120).nullable()
      table.enum('availability', ['open', 'not_open', 'consulting']).notNullable().defaultTo('open')
      table.enum('visibility', ['public', 'private']).notNullable().defaultTo('public')

      table.unique(['user_id'])
      table.index(['country_id'])
      table.index(['availability'])
      table.index(['visibility'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
