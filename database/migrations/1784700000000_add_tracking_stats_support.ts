import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

export default class extends BaseSchema {
  protected tableName = 'stats'

  async up() {
    // Use raw DDL so column creation completes before the unique index SQL runs.
    // Lucid schema builders are deferred until after `up` returns, which races rawQuery.
    await this.db.rawQuery(
      'alter table stats add column if not exists client_event_id varchar null'
    )
    await this.db.rawQuery(
      "alter table stats add column if not exists qualifiers jsonb not null default '{}'::jsonb"
    )
    await this.db.rawQuery(
      'create index if not exists stats_game_id_team_id_stat_type_id_index on stats (game_id, team_id, stat_type_id)'
    )
    await this.db.rawQuery(
      'create index if not exists stats_game_id_player_id_stat_type_id_index on stats (game_id, player_id, stat_type_id)'
    )
    await this.db.rawQuery(
      'create unique index if not exists stats_client_event_id_unique on stats (client_event_id) where client_event_id is not null'
    )

    const now = DateTime.utc().toSQL({ includeOffset: false }) ?? DateTime.utc().toISO()

    await this.db.rawQuery(
      `
      insert into stat_types (name, display_name, icon_name, category, created_at, updated_at)
      select ?, ?, ?, ?, ?, ?
      where not exists (select 1 from stat_types where name = ?)
      `,
      ['pass', 'Passes', 'swap-horizontal', 'performance', now, now, 'pass']
    )

    await this.db.rawQuery(
      `
      insert into stat_types (name, display_name, icon_name, category, created_at, updated_at)
      select ?, ?, ?, ?, ?, ?
      where not exists (select 1 from stat_types where name = ?)
      `,
      ['shot', 'Shots', 'radio-button-on', 'performance', now, now, 'shot']
    )

    const passType = await this.db.from('stat_types').select('id').where('name', 'pass').first()
    const shotType = await this.db.from('stat_types').select('id').where('name', 'shot').first()

    if (passType?.id) {
      await this.db.rawQuery(
        `create index if not exists stats_pass_events_idx on stats (game_id, team_id, player_id) where stat_type_id = ${Number(passType.id)}`
      )
    }

    if (shotType?.id) {
      await this.db.rawQuery(
        `create index if not exists stats_shot_events_idx on stats (game_id, team_id, player_id) where stat_type_id = ${Number(shotType.id)}`
      )
    }
  }

  async down() {
    await this.db.rawQuery('drop index if exists stats_shot_events_idx')
    await this.db.rawQuery('drop index if exists stats_pass_events_idx')
    await this.db.rawQuery('drop index if exists stats_client_event_id_unique')
    await this.db.rawQuery('drop index if exists stats_game_id_player_id_stat_type_id_index')
    await this.db.rawQuery('drop index if exists stats_game_id_team_id_stat_type_id_index')
    await this.db.rawQuery('alter table stats drop column if exists qualifiers')
    await this.db.rawQuery('alter table stats drop column if exists client_event_id')
  }
}
