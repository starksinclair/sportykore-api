import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import LeaguePlayer from '#models/league_player'
import LeagueFactory from '#factories/league_factory'
import PlayerFactory from '#factories/player_factory'
import SeasonFactory from '#factories/season_factory'
import TeamFactory from '#factories/team_factory'
import { rosterPositions } from '#validators/league_player'

export const LeaguePlayerFactory = factory
  .define(LeaguePlayer, ({ faker }) => ({
    isCaptain: faker.datatype.boolean({ probability: 0.12 }),
    jerseyNumber: String(faker.number.int({ min: 1, max: 99 })),
    joinedAt: DateTime.fromJSDate(faker.date.recent({ days: 120 })),
    leftAt: null,
    status: faker.helpers.arrayElement(['active', 'transferred', 'injured', 'suspended'] as const),
    position: faker.helpers.arrayElement(rosterPositions),
  }))
  .relation('league', () => LeagueFactory)
  .relation('player', () => PlayerFactory)
  .relation('season', () => SeasonFactory)
  .relation('team', () => TeamFactory)
  .build()

export default LeaguePlayerFactory
