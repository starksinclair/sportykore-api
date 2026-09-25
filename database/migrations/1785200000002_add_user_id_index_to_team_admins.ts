import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'team_admins'

  async up() {
    // team_admins.user_id is queried on its own (coach league-history
    // lookups) but the only existing index is the composite
    // unique(['team_id', 'user_id']), which has team_id leading and can't
    // serve a user_id-only lookup.
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['user_id'])
    })
  }
}
