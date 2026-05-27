import factory from '@adonisjs/lucid/factories'
import Stat from '#models/stat'
import GameFactory from '#factories/game_factory'
import LeagueFactory from '#factories/league_factory'
import PlayerFactory from '#factories/player_factory'
import SeasonFactory from '#factories/season_factory'
import TeamFactory from '#factories/team_factory'

export const StatFactory = factory
  .define(Stat, ({ faker }) => ({
    minute: faker.number.int({ min: 1, max: 90 }),
    isStoppageTime: faker.datatype.boolean({ probability: 0.08 }),
    numericValue: faker.number.int({ min: 1, max: 3 }),
    value: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.2 }),
    relatedPlayerId: null,
  }))
  .relation('game', () => GameFactory)
  .relation('league', () => LeagueFactory)
  .relation('season', () => SeasonFactory)
  .relation('player', () => PlayerFactory)
  .relation('team', () => TeamFactory)
  .build()

export default StatFactory
