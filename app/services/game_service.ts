import Game from '#models/game'

export class GameService {
  async getGameDetails(gameId: number) {
    return Game.query()
      .where('id', gameId)
      .preload('league')
      .preload('homeTeam')
      .preload('awayTeam')
      .preload('stats', (statsQuery) => {
        statsQuery.preload('type').preload('player').preload('team').preload('relatedPlayer')
      })
      .firstOrFail()
  }
}
