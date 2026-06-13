import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { Group } from '@japa/runner/core'
import { existsSync, unlinkSync } from 'node:fs'

import Country from '#models/country'

async function truncateAllTables() {
  const ace = await app.container.make('ace')
  const result = await ace.exec('db:truncate', [])
  if (result.exitCode) {
    throw result.error ?? new Error('db:truncate failed')
  }
}

function attachFreshDatabaseMigration(group: Group) {
  const sqlitePath = app.tmpPath('db.sqlite3')

  group.setup(async () => {
    if (process.env.DB_CONNECTION !== 'sqlite') {
      throw new Error(
        `Tests must use an isolated SQLite database (DB_CONNECTION=sqlite). Got "${process.env.DB_CONNECTION ?? 'unset'}".`
      )
    }

    await db.manager.closeAll()
    if (existsSync(sqlitePath)) {
      unlinkSync(sqlitePath)
    }
    const rollback = await testUtils.db().migrate()
    group.teardown(async () => {
      await rollback()
    })
  })
}

/**
 * Ensures a clean SQLite file, runs migrations, truncates between tests,
 * and rolls back migrations after the group.
 */
export function withFreshDatabase(group: Group) {
  attachFreshDatabaseMigration(group)
  group.each.setup(truncateAllTables)
}

/**
 * Same as {@link withFreshDatabase}, but re-seeds minimal countries after each truncate
 * (truncate clears migration defer inserts).
 */
export function withFreshDatabaseAndCountries(group: Group) {
  attachFreshDatabaseMigration(group)
  group.each.setup(async () => {
    await truncateAllTables()
    await Country.createMany([
      { name: 'Nigeria', code: 'ng' },
      { name: 'Ghana', code: 'gh' },
    ])
  })
}
