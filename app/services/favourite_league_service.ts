import { Exception } from '@adonisjs/core/exceptions'
import FavouriteLeague from '#models/favourite_league'
import type User from '#models/user'

export default class FavouriteLeagueService {
  async add(user: User, leagueId: number) {
    const exists = await FavouriteLeague.query()
      .where('user_id', user.id)
      .where('league_id', leagueId)
      .first()

    if (exists) {
      throw new Exception('League is already in favorites', { status: 409 })
    }

    await user.related('favoriteLeagues').attach([leagueId])
  }

  async remove(user: User, leagueId: number) {
    await user.related('favoriteLeagues').detach([leagueId])
  }
}
