import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import Game from '#models/game'
import LeagueFactory from '#factories/league_factory'
import SeasonFactory from '#factories/season_factory'
import TeamFactory from '#factories/team_factory'

const VENUES = [
  'Riverside Park — Pitch A',
  'Municipal Stadium (turf)',
  'Kingsway Training Ground',
  'Harborview Community Field',
  'Summit HS Athletic Complex',
] as const

export const GameFactory = factory
  .define(Game, ({ faker }) => {
    const kickoff = faker.date.soon({ days: 21 })
    const status = faker.helpers.arrayElement([
      'scheduled',
      'live',
      'break',
      'completed',
      'postponed',
      'cancelled',
    ] as const)

    const isFinished = status === 'completed'
    const home = isFinished ? faker.number.int({ min: 0, max: 4 }) : null
    const away = isFinished ? faker.number.int({ min: 0, max: 4 }) : null

    return {
      homeScore: home,
      awayScore: away,
      playedAt: DateTime.fromJSDate(kickoff),
      currentMinute:
        status === 'live' ? faker.number.int({ min: 1, max: 90 }) : status === 'completed' ? 90 : 0,
      status,
      venueName: faker.helpers.arrayElement(VENUES),
    }
  })
  .relation('league', () => LeagueFactory)
  .relation('season', () => SeasonFactory)
  .relation('homeTeam', () => TeamFactory)
  .relation('awayTeam', () => TeamFactory)
  .build()

export default GameFactory
