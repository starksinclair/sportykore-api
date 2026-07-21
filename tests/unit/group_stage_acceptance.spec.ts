import { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'

import Country from '#models/country'
import Game from '#models/game'
import League from '#models/league'
import Season from '#models/season'
import StageGroup from '#models/stage_group'
import StageTeam from '#models/stage_team'
import StandingZone from '#models/standing_zone'
import Team from '#models/team'
import Tie from '#models/tie'
import User from '#models/user'
import GroupStageService from '#services/group_stage_service'
import QualifierService from '#services/qualifier_service'
import StageStandingService from '#services/stage_standing_service'
import StandingAdjustmentService from '#services/standing_adjustment_service'
import StandingOverrideService from '#services/standing_override_service'
import StageService from '#services/stage_service'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

async function createOwnerLeagueSeasonTeams(teamCount: number, label = 'gs') {
  const owner = await User.create({
    email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@groups.test`,
    password: 'password1',
    fullName: `${label} Owner`,
  })
  const ng = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    userId: owner.id,
    name: `${label} League`,
    countryId: ng.id,
  })
  const season = await Season.create({
    leagueId: league.id,
    name: '2026',
    status: 'active',
  })
  const teams: Team[] = []
  for (let i = 0; i < teamCount; i++) {
    teams.push(
      await Team.create({
        leagueId: league.id,
        name: `Team ${String(i + 1).padStart(2, '0')}`,
        addedBy: owner.id,
      })
    )
  }
  return { owner, league, season, teams }
}

/** Lower seed always beats higher seed so group tables are decisive. */
async function playAllGroupGamesBySeed(stageId: number) {
  const stageTeams = await StageTeam.query().where('stage_id', stageId)
  const seedByTeam = new Map(stageTeams.map((st) => [st.teamId, st.seed ?? 999]))
  const games = await Game.query().where('stage_id', stageId)

  for (const g of games) {
    const homeSeed = seedByTeam.get(g.homeTeamId) ?? 999
    const awaySeed = seedByTeam.get(g.awayTeamId) ?? 999
    const homeWins = homeSeed < awaySeed
    const margin = (g.id % 3) + 1
    g.status = 'full_time'
    if (homeWins) {
      g.homeScore = margin + 1
      g.awayScore = 1
      g.winnerTeamId = g.homeTeamId
    } else {
      g.homeScore = 1
      g.awayScore = margin + 1
      g.winnerTeamId = g.awayTeamId
    }
    await g.save()
  }
}

function services() {
  const groupStage = new GroupStageService()
  const stageStanding = new StageStandingService()
  const qualifier = new QualifierService(stageStanding, groupStage, new StageService())
  const adjustments = new StandingAdjustmentService()
  const overrides = new StandingOverrideService(stageStanding)
  return { groupStage, stageStanding, qualifier, adjustments, overrides }
}

test.group('Group stage acceptance', (group) => {
  withFreshDatabaseAndCountries(group)

  test('16 teams, 4 groups, top 2 → 8 QF ties, no byes', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(16, 't16')
    const { groupStage, qualifier } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 4, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })

    const fixtures = await groupStage.generateGroupFixtures(stage.id)
    assert.equal(fixtures.count, 24)

    const groups = await StageGroup.query().where('stage_id', stage.id)
    for (const g of groups) {
      const groupGames = await Game.query().where('stage_group_id', g.id)
      assert.lengthOf(groupGames, 6)
    }

    await playAllGroupGamesBySeed(stage.id)

    const result = await qualifier.generateKnockout(stage.id, {})
    assert.lengthOf(result.qualifiers, 8)
    assert.equal(result.stage.sourceStageId, stage.id)

    const qfTies = await Tie.query().where('stage_id', result.stage.id).where('round', 'qf')
    assert.lengthOf(qfTies, 4)
    assert.isTrue(qfTies.every((t) => !t.isBye))

    await stage.refresh()
    assert.equal(stage.status, 'completed')
  })

  test('12 teams, 4 groups of 3, per_group 3 → bracket 16 with 4 byes', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(12, 'byes')
    const { groupStage, qualifier } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 4, double_round_robin: false },
        advancement: { per_group: 3 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })
    await groupStage.generateGroupFixtures(stage.id)
    await playAllGroupGamesBySeed(stage.id)

    const preview = await qualifier.resolveQualifiers(stage)
    assert.lengthOf(preview.qualifierTeamIds, 12)
    assert.equal(preview.bracketSize, 16)
    assert.equal(preview.byes, 4)

    const result = await qualifier.generateKnockout(stage.id, {})
    const startingTies = await Tie.query().where('stage_id', result.stage.id)
    const byeTies = startingTies.filter((t) => t.isBye)
    assert.lengthOf(byeTies, 4)
  })

  test('thirdsMode auto: 6×4, per_group 2, targetRound r16 → 16 qualifiers', async ({
    assert,
  }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(24, 'thirds-auto')
    const { groupStage, qualifier } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 6, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })
    await groupStage.generateGroupFixtures(stage.id)
    await playAllGroupGamesBySeed(stage.id)

    const preview = await qualifier.resolveQualifiers(stage, {
      targetRound: 'r16',
      thirdsMode: 'auto',
    })
    assert.equal(preview.thirdsNeeded, 4)
    assert.lengthOf(preview.automatic, 12)
    assert.lengthOf(preview.thirdsSelected, 4)
    assert.lengthOf(preview.qualifierTeamIds, 16)

    const result = await qualifier.generateKnockout(stage.id, {
      targetRound: 'r16',
      thirdsMode: 'auto',
    })
    assert.lengthOf(result.qualifiers, 16)
  })

  test('thirdsMode manual: 6×3, per_group 2, selectedThirds pick 4', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(18, 'thirds-manual')
    const { groupStage, qualifier } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 6, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })
    await groupStage.generateGroupFixtures(stage.id)
    await playAllGroupGamesBySeed(stage.id)

    const preview = await qualifier.resolveQualifiers(stage, {
      targetRound: 'r16',
      thirdsMode: 'auto',
      dryRun: true,
    })
    assert.equal(preview.thirdsNeeded, 4)
    assert.lengthOf(preview.thirdsCandidates, 6)

    const selectedThirds = preview.thirdsCandidates.slice(0, 4).map((t) => t.teamId)
    const result = await qualifier.generateKnockout(stage.id, {
      targetRound: 'r16',
      thirdsMode: 'manual',
      selectedThirds,
    })
    assert.lengthOf(result.qualifiers, 16)
    for (const id of selectedThirds) {
      assert.include(result.qualifiers, id)
    }
  })

  test('uneven 14 teams → group sizes 4,4,3,3 and 18 fixtures', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(14, 'uneven')
    const { groupStage } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 4, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })

    const groups = await StageGroup.query().where('stage_id', stage.id).orderBy('sequence', 'asc')
    const sizes: number[] = []
    for (const g of groups) {
      const members = await StageTeam.query()
        .where('stage_id', stage.id)
        .where('stage_group_id', g.id)
      sizes.push(members.length)
    }
    assert.deepEqual(sizes.sort((a, b) => b - a), [4, 4, 3, 3])

    const fixtures = await groupStage.generateGroupFixtures(stage.id)
    assert.equal(fixtures.count, 18)
  })

  test('point deduction changes position and pointsAdjustment', async ({ assert }) => {
    const { owner, league, season, teams } = await createOwnerLeagueSeasonTeams(3, 'deduct')
    const { groupStage, stageStanding, adjustments } = services()
    const [teamA, teamB, teamC] = teams

    const { stage, groups } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Mini',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'manual',
      assignments: [
        { teamId: teamA!.id, stageGroupId: groups[0]!.id },
        { teamId: teamB!.id, stageGroupId: groups[0]!.id },
        { teamId: teamC!.id, stageGroupId: groups[0]!.id },
      ],
    })
    await groupStage.generateGroupFixtures(stage.id)

    // C beats A, C beats B, A draws B → C 1st (6); A ahead of B on name at 1 pt each
    const games = await Game.query().where('stage_id', stage.id)
    for (const g of games) {
      const involvesC = g.homeTeamId === teamC!.id || g.awayTeamId === teamC!.id
      g.status = 'full_time'
      if (involvesC) {
        const cHome = g.homeTeamId === teamC!.id
        g.homeScore = cHome ? 2 : 0
        g.awayScore = cHome ? 0 : 2
        g.winnerTeamId = teamC!.id
      } else {
        g.homeScore = 1
        g.awayScore = 1
        g.winnerTeamId = null
      }
      await g.save()
    }

    let table = await stageStanding.forStage(stage.id)
    let rows = table.tables[0]!.rows
    assert.equal(rows[0]!.teamId, teamC!.id)
    assert.equal(rows[1]!.teamId, teamA!.id)
    assert.equal(rows[2]!.teamId, teamB!.id)

    await adjustments.create(stage.id, {
      teamId: teamA!.id,
      pointsDelta: -3,
      reason: 'Fair play',
      stageGroupId: groups[0]!.id,
      createdBy: owner.id,
    })

    table = await stageStanding.forStage(stage.id)
    rows = table.tables[0]!.rows
    const posA = rows.findIndex((r) => r.teamId === teamA!.id)
    const posB = rows.findIndex((r) => r.teamId === teamB!.id)
    assert.isTrue(posA > posB, 'A should rank below B after -3 deduction')
    const rowA = rows.find((r) => r.teamId === teamA!.id)!
    assert.equal(rowA.pointsAdjustment, -3)
    assert.equal(rowA.points, -2)
  })

  test('multiple deductions sum into pointsAdjustment', async ({ assert }) => {
    const { owner, league, season, teams } = await createOwnerLeagueSeasonTeams(2, 'sum')
    const { groupStage, stageStanding, adjustments } = services()

    const { stage, groups } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Mini',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 1 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'manual',
      assignments: [
        { teamId: teams[0]!.id, stageGroupId: groups[0]!.id },
        { teamId: teams[1]!.id, stageGroupId: groups[0]!.id },
      ],
    })
    await groupStage.generateGroupFixtures(stage.id)
    await playAllGroupGamesBySeed(stage.id)

    await adjustments.create(stage.id, {
      teamId: teams[0]!.id,
      pointsDelta: -3,
      reason: 'First',
      createdBy: owner.id,
    })
    await adjustments.create(stage.id, {
      teamId: teams[0]!.id,
      pointsDelta: -1,
      reason: 'Second',
      createdBy: owner.id,
    })

    const table = await stageStanding.forStage(stage.id)
    const row = table.tables[0]!.rows.find((r) => r.teamId === teams[0]!.id)!
    assert.equal(row.pointsAdjustment, -4)
  })

  test('override reorders tied cohort and sets manuallyAdjusted', async ({ assert }) => {
    const { owner, league, season, teams } = await createOwnerLeagueSeasonTeams(2, 'override-ok')
    const { groupStage, stageStanding, overrides } = services()
    const [teamA, teamB] = teams

    const { stage, groups } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Mini',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 1 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'manual',
      assignments: [
        { teamId: teamA!.id, stageGroupId: groups[0]!.id },
        { teamId: teamB!.id, stageGroupId: groups[0]!.id },
      ],
    })
    await groupStage.generateGroupFixtures(stage.id)

    // Force a draw so both are tied on points + played
    const game = await Game.query().where('stage_id', stage.id).firstOrFail()
    game.status = 'full_time'
    game.homeScore = 1
    game.awayScore = 1
    game.winnerTeamId = null
    await game.save()

    // Automatic order is by name; force the other order via override
    const before = await stageStanding.forStage(stage.id)
    const autoFirst = before.tables[0]!.rows[0]!.teamId
    const autoSecond = before.tables[0]!.rows[1]!.teamId

    await overrides.setCohort(stage.id, {
      stageGroupId: groups[0]!.id,
      reason: 'Coin toss',
      createdBy: owner.id,
      ranks: [
        { teamId: autoSecond, manualRank: 1 },
        { teamId: autoFirst, manualRank: 2 },
      ],
    })

    const after = await stageStanding.forStage(stage.id)
    const rows = after.tables[0]!.rows
    assert.equal(rows[0]!.teamId, autoSecond)
    assert.equal(rows[1]!.teamId, autoFirst)
    assert.isTrue(rows[0]!.manuallyAdjusted)
    assert.isTrue(rows[1]!.manuallyAdjusted)
    assert.lengthOf(after.tables[0]!.staleOverrides, 0)
  })

  test('override rejected when teams have different points', async ({ assert }) => {
    const { owner, league, season, teams } = await createOwnerLeagueSeasonTeams(2, 'override-bad')
    const { groupStage, overrides } = services()

    const { stage, groups } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Mini',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 1 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'manual',
      assignments: [
        { teamId: teams[0]!.id, stageGroupId: groups[0]!.id },
        { teamId: teams[1]!.id, stageGroupId: groups[0]!.id },
      ],
    })
    await groupStage.generateGroupFixtures(stage.id)
    await playAllGroupGamesBySeed(stage.id)

    try {
      await overrides.setCohort(stage.id, {
        stageGroupId: groups[0]!.id,
        createdBy: owner.id,
        ranks: [
          { teamId: teams[0]!.id, manualRank: 1 },
          { teamId: teams[1]!.id, manualRank: 2 },
        ],
      })
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 422)
    }
  })

  test('override becomes stale when a later result breaks the tie', async ({ assert }) => {
    const { owner, league, season, teams } = await createOwnerLeagueSeasonTeams(3, 'override-stale')
    const { groupStage, stageStanding, overrides } = services()
    const [teamA, teamB, teamC] = teams

    const { stage, groups } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Mini',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    await groupStage.assignTeams(stage.id, {
      mode: 'manual',
      assignments: [
        { teamId: teamA!.id, stageGroupId: groups[0]!.id },
        { teamId: teamB!.id, stageGroupId: groups[0]!.id },
        { teamId: teamC!.id, stageGroupId: groups[0]!.id },
      ],
    })
    await groupStage.generateGroupFixtures(stage.id)

    // Play only A vs B as draw; leave C games scheduled so A and B are tied 1pt each
    const games = await Game.query().where('stage_id', stage.id)
    const ab = games.find(
      (g) =>
        (g.homeTeamId === teamA!.id && g.awayTeamId === teamB!.id) ||
        (g.homeTeamId === teamB!.id && g.awayTeamId === teamA!.id)
    )!
    ab.status = 'full_time'
    ab.homeScore = 0
    ab.awayScore = 0
    await ab.save()

    const before = await stageStanding.forStage(stage.id)
    const tied = before.tables[0]!.rows.filter((r) => r.teamId === teamA!.id || r.teamId === teamB!.id)
    assert.lengthOf(tied, 2)
    assert.equal(tied[0]!.points, tied[1]!.points)

    await overrides.setCohort(stage.id, {
      stageGroupId: groups[0]!.id,
      reason: 'Head-to-head placeholder',
      createdBy: owner.id,
      ranks: [
        { teamId: tied[1]!.teamId, manualRank: 1 },
        { teamId: tied[0]!.teamId, manualRank: 2 },
      ],
    })

    let table = await stageStanding.forStage(stage.id)
    assert.isTrue(table.tables[0]!.rows.some((r) => r.manuallyAdjusted))

    // A beats C → A has 4 pts, B still 1 → cohort broken
    const ac = games.find(
      (g) =>
        (g.homeTeamId === teamA!.id && g.awayTeamId === teamC!.id) ||
        (g.homeTeamId === teamC!.id && g.awayTeamId === teamA!.id)
    )!
    const aHome = ac.homeTeamId === teamA!.id
    ac.status = 'full_time'
    ac.homeScore = aHome ? 2 : 0
    ac.awayScore = aHome ? 0 : 2
    ac.winnerTeamId = teamA!.id
    await ac.save()

    table = await stageStanding.forStage(stage.id)
    assert.isTrue(table.tables[0]!.staleOverrides.length >= 2)
    assert.isFalse(table.tables[0]!.rows.some((r) => r.manuallyAdjusted))

    const rowA = table.tables[0]!.rows.find((r) => r.teamId === teamA!.id)!
    const rowB = table.tables[0]!.rows.find((r) => r.teamId === teamB!.id)!
    assert.isTrue(rowA.position < rowB.position)
  })

  test('createGroupStage auto-seeds qualified zone 1..per_group', async ({ assert }) => {
    const { league, season } = await createOwnerLeagueSeasonTeams(0, 'zones')
    const { groupStage } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 4, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    const zones = await StandingZone.query().where('stage_id', stage.id)
    assert.lengthOf(zones, 1)
    assert.equal(zones[0]!.zoneType, 'qualified')
    assert.equal(zones[0]!.positionStart, 1)
    assert.equal(zones[0]!.positionEnd, 2)
    assert.isNull(zones[0]!.stageGroupId)
  })

  test('generateFixtures is idempotent (second call → 409)', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(4, 'idem')
    const { groupStage } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })
    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })
    await groupStage.generateGroupFixtures(stage.id)

    try {
      await groupStage.generateGroupFixtures(stage.id)
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 409)
    }
  })

  test('generateKnockout refuses incomplete games without force', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(4, 'incomplete')
    const { groupStage, qualifier } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 1, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })
    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })
    await groupStage.generateGroupFixtures(stage.id)
    // leave games scheduled

    try {
      await qualifier.generateKnockout(stage.id, {})
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 422)
    }
  })

  test('generateKnockout uses custom qualifiers array verbatim', async ({ assert }) => {
    const { league, season, teams } = await createOwnerLeagueSeasonTeams(8, 'custom-q')
    const { groupStage, qualifier } = services()

    const { stage } = await groupStage.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 2, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })
    await groupStage.assignTeams(stage.id, {
      mode: 'auto',
      teamIds: teams.map((t) => t.id),
    })
    await groupStage.generateGroupFixtures(stage.id)
    await playAllGroupGamesBySeed(stage.id)

    // Organizer picks a custom ordering of 4 teams (not necessarily the auto list order)
    const custom = [teams[7]!.id, teams[0]!.id, teams[3]!.id, teams[5]!.id]
    const result = await qualifier.generateKnockout(stage.id, {
      qualifiers: custom,
      force: true,
    })
    assert.deepEqual(result.qualifiers, custom)
  })
})
