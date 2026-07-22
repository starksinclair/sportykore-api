import { test } from '@japa/runner'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import Team from '#models/team'
import Tie from '#models/tie'
import User from '#models/user'
import BracketService from '#services/bracket_service'
import StageService from '#services/stage_service'
import TieResolver from '#services/tie_resolver'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'
import type { KnockoutStageConfig } from '#types/stage'

async function createUser(label: string) {
  return User.create({
    email: `${label}-${Date.now()}-${Math.random()}@knockout.test`,
    password: 'password1',
    fullName: label,
  })
}

async function seedKnockoutWorld(teamCount: number, config?: KnockoutStageConfig) {
  const owner = await createUser('owner')
  const ng = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    userId: owner.id,
    name: 'Knockout League',
    countryId: ng.id,
  })
  const season = await Season.create({
    leagueId: league.id,
    name: '2026',
    status: 'active',
  })
  await new StageService().ensureRoundRobinStage(season.id)

  const teams: Team[] = []
  for (let i = 0; i < teamCount; i++) {
    teams.push(
      await Team.create({
        leagueId: league.id,
        name: `Team ${i + 1}`,
        addedBy: owner.id,
      })
    )
  }

  const knockoutConfig: KnockoutStageConfig = config ?? {
    format: { starting_round: 'qf', has_third_place: true },
    ties: { default: { tie_format: 'single' } },
  }

  const stage = await new StageService().createKnockoutStage(league.id, season.id, {
    name: 'Cup',
    config: knockoutConfig,
  })

  return { owner, league, season, teams, stage, bracket: new BracketService(new StageService(), new TieResolver()) }
}

async function finishSingleGame(game: Game, homeScore: number, awayScore: number) {
  game.status = 'full_time'
  game.homeScore = homeScore
  game.awayScore = awayScore
  game.winnerTeamId = homeScore === awayScore ? null : homeScore > awayScore ? game.homeTeamId : game.awayTeamId
  if (homeScore === awayScore) {
    game.homePenaltyScore = 5
    game.awayPenaltyScore = 4
    game.winnerTeamId = game.homeTeamId
  }
  await game.save()
  await new TieResolver().advanceTie(game.tieId!)
}

test.group('Knockout bracket', (group) => {
  withFreshDatabaseAndCountries(group)

  test('clean 8-team path with third place', async ({ assert }) => {
    const { teams, stage, bracket } = await seedKnockoutWorld(8)
    await bracket.generateKnockoutPhase(
      stage.id,
      teams.map((t) => t.id)
    )

    const qfTies = await Tie.query().where('stage_id', stage.id).where('round', 'qf')
    assert.lengthOf(qfTies, 4)
    assert.isTrue(qfTies.every((t) => !t.isBye))

    for (const tie of qfTies) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      await finishSingleGame(game, 2, 1)
    }

    await bracket.generateNextRound(stage.id, 'qf')
    const sfTies = await Tie.query().where('stage_id', stage.id).where('round', 'sf')
    assert.lengthOf(sfTies, 2)

    for (const tie of sfTies) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      await finishSingleGame(game, 1, 0)
    }

    await bracket.generateNextRound(stage.id, 'sf')
    const finalTies = await Tie.query().where('stage_id', stage.id).where('round', 'final')
    const third = await Tie.query().where('stage_id', stage.id).where('round', 'third_place')
    assert.lengthOf(finalTies, 1)
    assert.lengthOf(third, 1)

    for (const tie of [...finalTies, ...third]) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      await finishSingleGame(game, 3, 2)
    }

    await bracket.generateNextRound(stage.id, 'final')
    await stage.refresh()
    assert.equal(stage.status, 'completed')

    const allTies = await Tie.query().where('stage_id', stage.id)
    assert.isTrue(allTies.every((t) => t.status === 'completed' && t.winnerTeamId !== null))
  })

  test('byes: seed 6 teams → bracketSize 8, 2 bye ties', async ({ assert }) => {
    const { teams, stage, bracket } = await seedKnockoutWorld(6, {
      format: { has_third_place: false },
      ties: { default: { tie_format: 'single' } },
    })

    await bracket.generateKnockoutPhase(
      stage.id,
      teams.map((t) => t.id)
    )

    const qf = await Tie.query().where('stage_id', stage.id).where('round', 'qf').orderBy('bracket_position')
    assert.lengthOf(qf, 4)

    const byes = qf.filter((t) => t.isBye)
    assert.lengthOf(byes, 2)
    assert.isTrue(byes.every((t) => t.status === 'completed' && t.winnerTeamId !== null))

    for (const bye of byes) {
      const games = await Game.query().where('tie_id', bye.id)
      assert.lengthOf(games, 0)
    }

    // Top 2 seeds get byes
    assert.equal(byes[0].winnerTeamId, teams[0].id)
    assert.equal(byes[1].winnerTeamId, teams[1].id)

    const contested = qf.filter((t) => !t.isBye)
    for (const tie of contested) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      await finishSingleGame(game, 1, 0)
    }

    await bracket.generateNextRound(stage.id, 'qf')
    const sf = await Tie.query().where('stage_id', stage.id).where('round', 'sf')
    assert.lengthOf(sf, 2)
    assert.isTrue(sf.every((t) => t.homeTeamId && t.awayTeamId))
  })

  test('best_of creates games on demand', async ({ assert }) => {
    const { teams, stage, bracket } = await seedKnockoutWorld(2, {
      format: { starting_round: 'final', has_third_place: false },
      ties: { default: { tie_format: 'best_of', best_of: 5 } },
    })

    await bracket.generateKnockoutPhase(stage.id, [teams[0].id, teams[1].id])
    const tie = await Tie.query().where('stage_id', stage.id).firstOrFail()
    assert.equal(tie.tieFormat, 'best_of')
    assert.equal(tie.bestOf, 5)
    assert.equal(tie.targetWins, 3)

    let games = await Game.query().where('tie_id', tie.id)
    assert.lengthOf(games, 1)

    // 3-0 sweep for series home (legs alternate venue home — score accordingly)
    for (let i = 0; i < 3; i++) {
      games = await Game.query().where('tie_id', tie.id).orderBy('leg')
      const open = games.find((g) => g.status !== 'full_time')
      assert.exists(open)
      const homeIsSeriesHome = open!.homeTeamId === tie.homeTeamId
      await finishSingleGame(open!, homeIsSeriesHome ? 1 : 0, homeIsSeriesHome ? 0 : 1)
    }

    await tie.refresh()
    assert.equal(tie.status, 'completed')
    assert.equal(tie.homeScoreAgg, 3)
    assert.equal(tie.awayScoreAgg, 0)
    games = await Game.query().where('tie_id', tie.id)
    assert.lengthOf(games, 3)
  })

  test('two_legged aggregate + second-leg pens', async ({ assert }) => {
    const { teams, stage, bracket } = await seedKnockoutWorld(2, {
      format: { starting_round: 'final', has_third_place: false },
      ties: { default: { tie_format: 'two_legged', away_goals: false } },
    })

    await bracket.generateKnockoutPhase(stage.id, [teams[0].id, teams[1].id])
    const tie = await Tie.query().where('stage_id', stage.id).firstOrFail()
    const games = await Game.query().where('tie_id', tie.id).orderBy('leg')
    assert.lengthOf(games, 2)

    // 1-1 and 0-0 → pens on 2nd leg
    games[0].status = 'full_time'
    games[0].homeScore = 1
    games[0].awayScore = 1
    games[0].winnerTeamId = null
    await games[0].save()
    await new TieResolver().advanceTie(tie.id)

    await tie.refresh()
    assert.notEqual(tie.status, 'completed')

    games[1].status = 'full_time'
    games[1].homeScore = 0
    games[1].awayScore = 0
    games[1].homePenaltyScore = 4
    games[1].awayPenaltyScore = 3
    games[1].winnerTeamId = games[1].homeTeamId
    await games[1].save()
    await new TieResolver().advanceTie(tie.id)

    await tie.refresh()
    assert.equal(tie.status, 'completed')
    assert.equal(tie.homeScoreAgg, 1)
    assert.equal(tie.awayScoreAgg, 1)
    assert.equal(tie.winnerTeamId, games[1].homeTeamId)
  })

  test('next-round is idempotent', async ({ assert }) => {
    const { teams, stage, bracket } = await seedKnockoutWorld(4, {
      format: { starting_round: 'sf', has_third_place: false },
      ties: { default: { tie_format: 'single' } },
    })

    await bracket.generateKnockoutPhase(
      stage.id,
      teams.map((t) => t.id)
    )

    const sf = await Tie.query().where('stage_id', stage.id).where('round', 'sf')
    for (const tie of sf) {
      const game = await Game.query().where('tie_id', tie.id).firstOrFail()
      await finishSingleGame(game, 2, 0)
    }

    await bracket.generateNextRound(stage.id, 'sf')
    await bracket.generateNextRound(stage.id, 'sf')

    const finals = await Tie.query().where('stage_id', stage.id).where('round', 'final')
    assert.lengthOf(finals, 1)
  })
})
