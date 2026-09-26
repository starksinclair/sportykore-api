import { BaseSchema } from '@adonisjs/lucid/schema'

import env from '#start/env'

export default class extends BaseSchema {
  async up() {
    if (env.get('DB_CONNECTION') === 'sqlite') {
      return
    }

    await this.db.rawQuery('alter table leagues alter column user_id drop not null')
    await this.db.rawQuery('alter table teams alter column added_by drop not null')
    await this.db.rawQuery('alter table players alter column user_id drop not null')
    await this.db.rawQuery('alter table players alter column country_id drop not null')

    await this.db.rawQuery(`
      alter table leagues
      drop constraint if exists leagues_user_id_foreign,
      add constraint leagues_user_id_foreign
        foreign key (user_id) references users(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table teams
      drop constraint if exists teams_added_by_foreign,
      add constraint teams_added_by_foreign
        foreign key (added_by) references users(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table teams
      drop constraint if exists teams_league_id_foreign,
      add constraint teams_league_id_foreign
        foreign key (league_id) references leagues(id) on delete cascade
    `)

    await this.db.rawQuery(`
      alter table invites
      drop constraint if exists invites_league_id_foreign,
      add constraint invites_league_id_foreign
        foreign key (league_id) references leagues(id) on delete cascade
    `)

    await this.db.rawQuery(`
      alter table players
      drop constraint if exists players_user_id_foreign,
      add constraint players_user_id_foreign
        foreign key (user_id) references users(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table players
      drop constraint if exists players_country_id_foreign,
      add constraint players_country_id_foreign
        foreign key (country_id) references countries(id) on delete set null
    `)
  }

  async down() {
    if (env.get('DB_CONNECTION') === 'sqlite') {
      return
    }

    await this.db.rawQuery(`
      alter table invites
      drop constraint if exists invites_league_id_foreign,
      add constraint invites_league_id_foreign
        foreign key (league_id) references leagues(id)
    `)

    await this.db.rawQuery(`
      alter table teams
      drop constraint if exists teams_league_id_foreign,
      add constraint teams_league_id_foreign
        foreign key (league_id) references leagues(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table players
      drop constraint if exists players_country_id_foreign,
      add constraint players_country_id_foreign
        foreign key (country_id) references countries(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table players
      drop constraint if exists players_user_id_foreign,
      add constraint players_user_id_foreign
        foreign key (user_id) references users(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table teams
      drop constraint if exists teams_added_by_foreign,
      add constraint teams_added_by_foreign
        foreign key (added_by) references users(id) on delete set null
    `)

    await this.db.rawQuery(`
      alter table leagues
      drop constraint if exists leagues_user_id_foreign,
      add constraint leagues_user_id_foreign
        foreign key (user_id) references users(id) on delete set null
    `)

    await this.db.rawQuery(`
      do $$
      begin
        if not exists (select 1 from leagues where user_id is null) then
          alter table leagues alter column user_id set not null;
        end if;
        if not exists (select 1 from teams where added_by is null) then
          alter table teams alter column added_by set not null;
        end if;
        if not exists (select 1 from players where user_id is null) then
          alter table players alter column user_id set not null;
        end if;
        if not exists (select 1 from players where country_id is null) then
          alter table players alter column country_id set not null;
        end if;
      end $$;
    `)
  }
}
