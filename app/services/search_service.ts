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
               -- Private players surface as name only (no team membership)
               (CASE
                  WHEN p.visibility = 'private' THEN NULL
                  ELSE (SELECT name FROM teams WHERE id = lp.team_id LIMIT 1)
                END)                   as sublabel,
               NULL                    as countryCode,
               NULL                    as logoUrl
        FROM players p
          LEFT JOIN league_players lp
        ON lp.player_id = p.id
        WHERE LOWER (p.name) LIKE ?

        UNION ALL

        -- Ordered after player (not before) so coach matches don't steal
        -- rows from the shared LIMIT ahead of the higher-traffic player
        -- search results; there is no ORDER BY, so UNION ALL emission
        -- order is what determines which rows survive truncation.
        SELECT CONCAT('', cp.id) as id,
               'coach'           as type,
               cp.display_name   as label,
               (CASE
                  WHEN cp.availability = 'open' THEN 'Coach · Open to roles'
                  WHEN cp.availability = 'consulting' THEN 'Coach · Available for consulting'
                  ELSE 'Coach'
                END)             as sublabel,
               c.code            as countryCode,
               cp.photo_url      as logoUrl
        FROM coach_profiles cp
               LEFT JOIN countries c ON c.id = cp.country_id
        WHERE cp.visibility = 'public'
          AND (
            LOWER(cp.display_name) LIKE ?
            OR LOWER(COALESCE(cp.city, '')) LIKE ?
            OR LOWER(COALESCE(cp.state, '')) LIKE ?
          )

          LIMIT ?
      `,
      [like, like, like, like, like, like, like, limit]
    )
  }
}
