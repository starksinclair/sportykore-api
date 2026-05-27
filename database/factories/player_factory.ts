import factory from '@adonisjs/lucid/factories'
import Player from '#models/player'
import UserFactory from '#factories/user_factory'

export const PlayerFactory = factory
  .define(Player, ({ faker }) => ({
    name: `${faker.person.firstName()} ${faker.person.lastName()}`,
    bio: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          'Winger — prefers cutting inside on the right.',
          'Holding mid; reads the press well.',
          'Goalkeeper, sweeper-keeper style.',
          'Target forward; strong in the air.',
        ]),
      { probability: 0.45 }
    ),
    avatarUrl: null,
    addedBy: null,
  }))
  .relation('user', () => UserFactory)
  .build()

export default PlayerFactory
