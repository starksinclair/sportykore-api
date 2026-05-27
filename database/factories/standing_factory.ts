import factory from '@adonisjs/lucid/factories'
import Standing from '#models/standing'
import LeagueFactory from '#factories/league_factory'
import SeasonFactory from '#factories/season_factory'
import TeamFactory from '#factories/team_factory'

const FORM_OUTCOMES = ['W', 'D', 'L'] as const

export const StandingFactory = factory
  .define(Standing, ({ faker }) => {
    const played = faker.number.int({ min: 0, max: 38 })
    const wins = faker.number.int({ min: 0, max: played })
    const remaining = played - wins
    const draws = faker.number.int({ min: 0, max: remaining })
    const losses = remaining - draws
    const goalsFor = faker.number.int({ min: 0, max: played * 4 })
    const goalsAgainst = faker.number.int({ min: 0, max: played * 4 })

    return {
      position: faker.number.int({ min: 1, max: 20 }),
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points: wins * 3 + draws,
      form: faker.helpers
        .arrayElements(FORM_OUTCOMES, faker.number.int({ min: 1, max: 5 }))
        .join(','),
    }
  })
  .relation('league', () => LeagueFactory)
  .relation('season', () => SeasonFactory)
  .relation('team', () => TeamFactory)
  .build()

export default StandingFactory
