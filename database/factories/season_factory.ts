import factory from '@adonisjs/lucid/factories'
import Season from '#models/season'
import LeagueFactory from '#factories/league_factory'

export const SeasonFactory = factory
  .define(Season, ({ faker }) => {
    const year = faker.number.int({ min: 2023, max: 2027 })
    return {
      name: `${year} — Fall/Winter`,
      status: faker.helpers.arrayElement(['inactive', 'active', 'completed'] as const),
    }
  })
  .relation('league', () => LeagueFactory)
  .build()

export default SeasonFactory
