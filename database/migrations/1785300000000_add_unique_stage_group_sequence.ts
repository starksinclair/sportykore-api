import { BaseSchema } from '@adonisjs/lucid/schema'

type StageGroupRow = {
  id: number
  stage_id: number
  sequence: number
}

const STAGE_GROUP_REFERENCE_TABLES = [
  'stage_teams',
  'games',
  'standings',
  'standing_adjustments',
  'standing_overrides',
  'standing_zones',
]

export default class extends BaseSchema {
  async up() {
    const rows = (await this.db
      .from('stage_groups')
      .select('id', 'stage_id', 'sequence')
      .orderBy('stage_id', 'asc')
      .orderBy('sequence', 'asc')
      .orderBy('id', 'asc')) as StageGroupRow[]

    const keepers = new Map<string, number>()
    const duplicates: Array<{ duplicateId: number; keeperId: number }> = []

    for (const row of rows) {
      const key = `${row.stage_id}:${row.sequence}`
      const keeperId = keepers.get(key)
      if (keeperId) {
        duplicates.push({ duplicateId: row.id, keeperId })
      } else {
        keepers.set(key, row.id)
      }
    }

    for (const { duplicateId, keeperId } of duplicates) {
      for (const tableName of STAGE_GROUP_REFERENCE_TABLES) {
        await this.db
          .from(tableName)
          .where('stage_group_id', duplicateId)
          .update({ stage_group_id: keeperId })
      }
    }

    if (duplicates.length > 0) {
      await this.db
        .from('stage_groups')
        .whereIn(
          'id',
          duplicates.map((row) => row.duplicateId)
        )
        .delete()
    }

    await this.db.rawQuery(
      'create unique index if not exists stage_groups_stage_id_sequence_unique on stage_groups (stage_id, sequence)'
    )
  }

  async down() {
    await this.db.rawQuery('drop index if exists stage_groups_stage_id_sequence_unique')
  }
}
