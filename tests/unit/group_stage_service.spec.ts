import { test } from '@japa/runner'

import Country from '#models/country'
import League from '#models/league'
import Season from '#models/season'
import StageGroup from '#models/stage_group'
import StandingZone from '#models/standing_zone'
import User from '#models/user'
import GroupStageService from '#services/group_stage_service'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

test.group('GroupStageService.createGroupStage', (group) => {
  withFreshDatabaseAndCountries(group)

  test('creates groups A..N and qualified zone', async ({ assert }) => {
    const owner = await User.create({
      email: `group-${Date.now()}@test.local`,
      password: 'password1',
      fullName: 'Owner',
    })
    const ng = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      userId: owner.id,
      name: 'Group League',
      countryId: ng.id,
    })
    const season = await Season.create({
      leagueId: league.id,
      name: '2026',
      status: 'active',
    })

    const service = new GroupStageService()
    const { stage, groups } = await service.createGroupStage(league.id, season.id, {
      name: 'Groups',
      config: {
        format: { group_count: 4, double_round_robin: false },
        advancement: { per_group: 2 },
      },
    })

    assert.equal(stage.stageType, 'group')
    assert.equal(stage.status, 'upcoming')
    assert.lengthOf(groups, 4)
    assert.deepEqual(
      groups.map((g) => g.name),
      ['A', 'B', 'C', 'D']
    )

    const zones = await StandingZone.query().where('stage_id', stage.id)
    assert.lengthOf(zones, 1)
    assert.equal(zones[0]!.zoneType, 'qualified')
    assert.equal(zones[0]!.positionStart, 1)
    assert.equal(zones[0]!.positionEnd, 2)
    assert.isNull(zones[0]!.stageGroupId)

    const dbGroups = await StageGroup.query().where('stage_id', stage.id).orderBy('sequence', 'asc')
    assert.lengthOf(dbGroups, 4)
  })
})
