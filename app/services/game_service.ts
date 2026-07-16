import Game from '#models/game'

export class GameService {
  async getGameDetails(gameId: number) {
    return Game.query()
      .where('id', gameId)
      .preload('league')
      .preload('homeTeam')
      .preload('awayTeam')
      .preload('venue')
      .preload('stats', (statsQuery) => {
        statsQuery.preload('type').preload('player').preload('team').preload('relatedPlayer')
      })
      .preload('lineups', (lineupsQuery) => {
        lineupsQuery
          .preload('player')
          .preload('team', (teamQuery) => {
            teamQuery.preload('admins', (adminsQuery) => {
              adminsQuery.whereNull('removed_at').preload('user').orderBy('id', 'asc')
            })
          })
          .preload('formation')
          .orderBy('team_id', 'asc')
          .orderBy('starting_order', 'asc')
          .orderBy('id', 'asc')
      })
      .firstOrFail()
  }
}
