import { BaseSchema } from '@adonisjs/lucid/schema'
import env from '#start/env'

export default class extends BaseSchema {
  protected tableName = 'player_social_links'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('player_id').unsigned().nullable().alter()
      table
        .integer('coach_profile_id')
        .unsigned()
        .references('id')
        .inTable('coach_profiles')
        .onDelete('CASCADE')
        .nullable()

      table.unique(['coach_profile_id', 'platform'])
      table.index(['coach_profile_id'])
    })

    if (env.get('DB_CONNECTION') !== 'sqlite') {
      this.defer(async (db) => {
        await db.rawQuery(`
          ALTER TABLE ${this.tableName}
          ADD CONSTRAINT player_social_links_one_owner_check
          CHECK (
            (player_id IS NOT NULL AND coach_profile_id IS NULL)
            OR (player_id IS NULL AND coach_profile_id IS NOT NULL)
          )
        `)
      })
    }
  }

  async down() {
    if (env.get('DB_CONNECTION') !== 'sqlite') {
      this.defer(async (db) => {
        await db.rawQuery(`
          ALTER TABLE ${this.tableName}
          DROP CONSTRAINT IF EXISTS player_social_links_one_owner_check
        `)
      })
    }

    // Rolling back removes the ability to represent coach-owned rows at
    // all (player_id is about to become NOT NULL again), so any row that
    // only has a coach_profile_id has to go first — otherwise restoring
    // the NOT NULL constraint below fails outright once any coach has
    // saved a social link.
    this.defer(async (db) => {
      await db.from(this.tableName).whereNull('player_id').delete()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['coach_profile_id'])
      table.dropUnique(['coach_profile_id', 'platform'])
      table.dropColumn('coach_profile_id')
      table.integer('player_id').unsigned().notNullable().alter()
    })
  }
}
