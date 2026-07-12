import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import { Exception } from '@adonisjs/core/exceptions'

import Country from '#models/country'
import Formation from '#models/formation'
import Game from '#models/game'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import Season from '#models/season'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import User from '#models/user'
import LineupService from '#services/lineup_service'
import { formations } from '../../database/data/formations.js'
import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

const FOUR_THREE_THREE_SLOTS = [
  'GK_1',
  'RB_1',
  'CB_1',
  'CB_2',
  'LB_1',
  'CM_1',
  'CM_2',
  'CM_3',
  'RW_1',
  'ST_1',
  'LW_1',
] as const

async function createUser(label: string) {
  return User.create({
    email: `${label}-${Date.now()}-${Math.random()}@lineup.test`,
    password: 'password1',
    fullName: label,
  })
}

async function createRosterPlayers(
  ownerId: number,
  countryId: number,
  count: number,
  prefix: string
) {
  const players: Player[] = []

  for (let index = 0; index < count; index++) {
    const user = await createUser(`${prefix}-player-${index}`)
    players.push(
      await Player.create({
        userId: user.id,
        addedBy: ownerId,
        countryId,
        name: `${prefix} Player ${index + 1}`,
      })
    )
  }

  return players
}

async function seedLineupFixture() {
  const owner = await createUser('league-owner')
  const ng = await Country.findByOrFail('code', 'ng')
  const league = await League.create({
    userId: owner.id,
    name: 'Lineup League',
    countryId: ng.id,
  })
  const season = await Season.create({
    leagueId: league.id,
    name: '2026',
    status: 'active',
  })
  const home = await Team.create({ leagueId: league.id, name: 'Home FC', addedBy: owner.id })
  const away = await Team.create({ leagueId: league.id, name: 'Away FC', addedBy: owner.id })
  const game = await Game.create({
    leagueId: league.id,
    seasonId: season.id,
    homeTeamId: home.id,
    awayTeamId: away.id,
    playedAt: DateTime.utc(),
    status: 'scheduled',
  })
  const formation = await ensureFormation('4-3-3')
  const homePlayers = await createRosterPlayers(owner.id, ng.id, 12, 'home')
  const awayPlayers = await createRosterPlayers(owner.id, ng.id, 12, 'away')

  for (const [index, player] of homePlayers.entries()) {
    await LeaguePlayer.create({
      leagueId: league.id,
      seasonId: season.id,
      teamId: home.id,
      playerId: player.id,
      joinedAt: DateTime.utc(),
      jerseyNumber: String(index + 1),
      status: 'active',
      position: 'midfield',
    })
  }

  for (const [index, player] of awayPlayers.entries()) {
    await LeaguePlayer.create({
      leagueId: league.id,
      seasonId: season.id,
      teamId: away.id,
      playerId: player.id,
      joinedAt: DateTime.utc(),
      jerseyNumber: String(index + 1),
      status: 'active',
      position: 'midfield',
    })
  }

  return {
    owner,
    league,
    season,
    home,
    away,
    game,
    formation,
    homePlayers,
    awayPlayers,
  }
}

function buildStarters(players: Player[], slots: readonly string[] = FOUR_THREE_THREE_SLOTS) {
  return slots.map((slotKey, index) => ({
    playerId: players[index].id,
    slotKey,
    jerseyNumber: index + 1,
  }))
}

async function ensureFormation(name: string) {
  const existing = await Formation.findBy('name', name)
  if (existing) {
    return existing
  }

  const definition = formations.find((row) => row.name === name)
  if (!definition) {
    throw new Error(`Formation ${name} not found in seed data`)
  }

  return Formation.create({
    name: definition.name,
    displayName: definition.displayName,
    slots: JSON.stringify(definition.slots),
    isActive: true,
  })
}

test.group('LineupService', (group) => {
  withFreshDatabaseAndCountries(group)

  test('setLineup validates exactly 11 starters and required formation slots', async ({ assert }) => {
    const service = new LineupService()
    const { owner, game, formation, home, homePlayers } = await seedLineupFixture()

    try {
      await service.setLineup(owner.id, game.id, {
        teamId: home.id,
        formationId: formation.id,
        starters: buildStarters(homePlayers).slice(0, 10),
        substitutes: [],
      })
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 422)
    }

    try {
      await service.setLineup(owner.id, game.id, {
        teamId: home.id,
        formationId: formation.id,
        starters: buildStarters(homePlayers).map((starter) =>
          starter.slotKey === 'GK_1' ? { ...starter, slotKey: 'INVALID' } : starter
        ),
        substitutes: [],
      })
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 422)
    }

    const rows = await service.setLineup(owner.id, game.id, {
      teamId: home.id,
      formationId: formation.id,
      starters: buildStarters(homePlayers),
      substitutes: [{ playerId: homePlayers[11].id, jerseyNumber: 12 }],
    })

    assert.lengthOf(rows, 12)
    assert.equal(rows.filter((row) => row.status === 'starter').length, 11)
  })

  test('team admin cannot set lineup for the opponent team', async ({ assert }) => {
    const service = new LineupService()
    const { league, game, formation, home, away, homePlayers } = await seedLineupFixture()
    const adminUser = await createUser('team-admin')

    await TeamAdmin.create({
      leagueId: league.id,
      teamId: home.id,
      userId: adminUser.id,
      assignedBy: league.userId,
    })

    try {
      await service.setLineup(adminUser.id, game.id, {
        teamId: away.id,
        formationId: formation.id,
        starters: buildStarters(homePlayers),
        substitutes: [],
      })
      assert.fail('expected Exception')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 403)
    }
  })

  test('league owner can set lineup for either team', async ({ assert }) => {
    const service = new LineupService()
    const { owner, game, formation, away, awayPlayers } = await seedLineupFixture()

    const rows = await service.setLineup(owner.id, game.id, {
      teamId: away.id,
      formationId: formation.id,
      starters: buildStarters(awayPlayers),
      substitutes: [],
    })

    assert.lengthOf(rows, 11)
    assert.isTrue(rows.every((row) => row.teamId === away.id))
  })

  test('updateLineup patches jersey number and slot key', async ({ assert }) => {
    const service = new LineupService()
    const { owner, game, formation, home, homePlayers } = await seedLineupFixture()

    const rows = await service.setLineup(owner.id, game.id, {
      teamId: home.id,
      formationId: formation.id,
      starters: buildStarters(homePlayers),
      substitutes: [],
    })

    const starter = rows.find((row) => row.slotKey === 'ST_1')!
    const updated = await service.updateLineup(owner.id, game.id, starter.id, {
      jerseyNumber: 99,
    })

    assert.equal(updated.jerseyNumber, 99)
    assert.equal(updated.slotKey, 'ST_1')

    const rwStarter = rows.find((row) => row.slotKey === 'RW_1')!
    await service.updateLineup(owner.id, game.id, rwStarter.id, {
      status: 'substitute',
    })

    const moved = await service.updateLineup(owner.id, game.id, starter.id, {
      slotKey: 'RW_1',
    })

    assert.equal(moved.slotKey, 'RW_1')
    assert.equal(moved.position, 'RW')
  })
})
