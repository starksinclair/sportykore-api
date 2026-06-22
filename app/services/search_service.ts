import db from '@adonisjs/lucid/services/db'

export class SearchService {
  public async search(query: string, limit: number) {
    const like = `%${query.toLowerCase()}%`
    return db.rawQuery(
      `
        SELECT CONCAT('', id) as id,
               'country'                as type,
               name                     as label,
               code                     as sublabel,
               code                     as countryCode,
               NULL                     as logoUrl
        FROM countries
        WHERE LOWER(name) LIKE ?

        UNION ALL

        SELECT CONCAT('', l.id) as id,
               'league'                as type,
               l.name                  as label,
               c.name                  as sublabel,
               c.code                  as countryCode,
               l.logo_url              as logoUrl
        FROM leagues l
               LEFT JOIN countries c ON c.id = l.country_id
        WHERE LOWER(l.name) LIKE ?

        UNION ALL

        SELECT CONCAT('', t.id) as id,
               'team'                as type,
               t.name                as label,
               l.name                as sublabel,
               c.code                as countryCode,
               t.logo_url            as logoUrl
        FROM teams t
               LEFT JOIN leagues l ON l.id = t.league_id
               LEFT JOIN countries c ON c.id = l.country_id
        WHERE LOWER(t.name) LIKE ?

        UNION ALL

        SELECT CONCAT('', p.id) as                    id,
               'player'                as                    type,
               p.name                  as                    label,
               (SELECT name FROM teams WHERE id = lp.team_id LIMIT 1) as sublabel,
               NULL                    as countryCode,
               NULL                    as logoUrl
        FROM players p
          LEFT JOIN league_players lp
        ON lp.player_id = p.id
        WHERE LOWER (p.name) LIKE ?

          LIMIT ?
      `,
      [like, like, like, like, limit]
    )
  }
}
