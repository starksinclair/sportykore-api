import factory from '@adonisjs/lucid/factories'
import League from '#models/league'
import UserFactory from '#factories/user_factory'

const LEAGUE_NAMES = [
  'Sunday Premier Division',
  'Northside 7v7 Cup',
  'Riverside Over-30 League',
  'Kingsway Youth Academy',
  'Municipal Pitch Night League',
  'Coastal FC Winter Classic',
] as const

export const LeagueFactory = factory
  .define(League, ({ faker }) => ({
    name: faker.helpers.arrayElement(LEAGUE_NAMES),
    description: faker.helpers.arrayElement([
      '11-a-side, FIFA Laws with local adaptations.',
      'Small-sided league — rolling subs, 25-minute halves.',
      'Recreational division; fair play points tracked each week.',
      'Competitive tier with promotion at season end.',
    ]),
    gender: faker.helpers.arrayElement(['mens', 'womens', 'mixed', 'open']),
    logoUrl: null,
  }))
  .relation('user', () => UserFactory)
  .build()

export default LeagueFactory
