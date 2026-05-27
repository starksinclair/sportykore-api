import factory from '@adonisjs/lucid/factories'
import Team from '#models/team'
import LeagueFactory from '#factories/league_factory'
import UserFactory from '#factories/user_factory'

const TEAM_NAMES = [
  'Riverside United',
  'Kingsway Rovers',
  'Harborview Athletic',
  'Northline Strikers',
  'Summit City FC',
  'Old Town Wanderers',
  'Pitchside Rangers',
  'Lakeside 96',
] as const

export const TeamFactory = factory
  .define(Team, ({ faker }) => ({
    name: `${faker.helpers.arrayElement(TEAM_NAMES)} ${faker.string.numeric(2)}`,
    logoUrl: null,
  }))
  .relation('league', () => LeagueFactory)
  .relation('user', () => UserFactory)
  .build()

export default TeamFactory
