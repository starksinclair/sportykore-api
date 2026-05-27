import factory from '@adonisjs/lucid/factories'
import User from '#models/user'

const SOCCER_FIRST = [
  'Marcus',
  'Jordan',
  'Samuel',
  'Diego',
  'Luca',
  'André',
  'Kwame',
  'Hannah',
  'Priya',
  'Elena',
] as const

const SOCCER_LAST = [
  'Nwosu',
  'Silva',
  'Okafor',
  'Martínez',
  'van der Berg',
  'Okonkwo',
  'Rossi',
  'Kim',
  'Santos',
  'Mensah',
] as const

export const UserFactory = factory
  .define(User, ({ faker }) => {
    const first = faker.helpers.arrayElement(SOCCER_FIRST)
    const last = faker.helpers.arrayElement(SOCCER_LAST)
    const handle = faker.string.alphanumeric(8).toLowerCase()

    return {
      email: `${handle}@kpakore.test`,
      password: 'kickoff-secret',
      fullName: `${first} ${last}`,
    }
  })
  .build()

export default UserFactory
