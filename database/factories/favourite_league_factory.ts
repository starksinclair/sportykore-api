import factory from '@adonisjs/lucid/factories'

import FavouriteLeague from '#models/favourite_league'
import LeagueFactory from '#factories/league_factory'
import UserFactory from '#factories/user_factory'

export const FavouriteLeagueFactory = factory
  .define(FavouriteLeague, () => ({}))
  .relation('user', () => UserFactory)
  .relation('league', () => LeagueFactory)
  .build()

export default FavouriteLeagueFactory
