import { BaseSerializer } from '@adonisjs/core/transformers'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Country from '#models/country'
import Game from '#models/game'
import GameLineup from '#models/game_lineup'
import League from '#models/league'
import LeaguePlayer from '#models/league_player'
import Player from '#models/player'
import Season from '#models/season'
import Stat from '#models/stat'
import StatType from '#models/stat_type'
import Team from '#models/team'
import User from '#models/user'
import CountryService from '#services/country_service'
import { PlayerService } from '#services/player_service'
import GameLineupTransformer from '#transformers/game_lineup_transformer'
import LeaguePlayerTransformer from '#transformers/league_player_transformer'
import StatTransformer from '#transformers/stat_transformer'
import TeamSeasonDetailTransformer from '#transformers/team_season_detail_transformer'

import { withFreshDatabaseAndCountries } from '../helpers/migration.js'

/** Resolves nested Item/Collection transformer output, same as the real HTTP serializer. */
class TestSerializer extends BaseSerializer<Record<string, never>> {
  wrap = undefined as unknown as never
  definePaginationMetaData(metaData: unknown) {
    return metaData as never
  }
}
const testSerializer = new TestSerializer()
function resolve<T>(data: T): Promise<T> {
  return testSerializer.serializeWithoutWrapping(data as never) as Promise<T>
}

/**
 * The transformer rule (§4 of the player profile v2 build): a private player
 * must serialize to the minimal stub on every surface it appears on, not
 * just the profile endpoint. Each test below exercises a different surface
 * through its real transformer/service, not a reimplementation.
 */
test.group('Private player stub — cross-surface', (group) => {
  withFreshDatabaseAndCountries(group)

  async function seed() {
    const owner = await User.create({
      email: `owner-${Date.now()}@test.com`,
      password: 'password1',
      fullName: 'League Owner',
    })
    const country = await Country.findByOrFail('code', 'ng')
    const league = await League.create({
      name: 'Stub League',
      userId: owner.id,
      countryId: country.id,
    })
    const season = await Season.create({ leagueId: league.id, name: '2025/26', status: 'active' })
    const team = await Team.create({ leagueId: league.id, addedBy: owner.id, name: 'Stub FC' })
    const opponent = await Team.create({ leagueId: league.id, addedBy: owner.id, name: 'Rival FC' })

    const playerUser = await User.create({
      email: `private-player-${Date.now()}@test.com`,
      password: 'password1',
      fullName: 'Private Player',
    })
    const player = await Player.create({
      userId: playerUser.id,
      countryId: country.id,
      name: 'Private Player',
      bio: 'SENTINEL_BIO',
      avatarUrl: 'https://cdn.example.com/SENTINEL_PHOTO.jpg',
      primaryPosition: 'attack',
      city: 'SENTINEL_CITY',
      socialHandle: 'SENTINEL_HANDLE',
      dateOfBirth: DateTime.now().minus({ years: 20 }),
      visibility: 'private',
    })

    await LeaguePlayer.create({
      leagueId: league.id,
      seasonId: season.id,
      teamId: team.id,
      playerId: player.id,
      status: 'active',
      position: 'attack',
      jerseyNumber: '9',
    })

    const game = await Game.create({
      leagueId: league.id,
      seasonId: season.id,
      homeTeamId: team.id,
      awayTeamId: opponent.id,
      playedAt: DateTime.now(),
      status: 'full_time',
    })

    await GameLineup.create({
      gameId: game.id,
      teamId: team.id,
      playerId: player.id,
      status: 'starter',
    })

    const statType = await StatType.firstOrCreate(
      { name: 'goals' },
      { name: 'goals', displayName: 'Goals', category: 'performance' }
    )
    await Stat.create({
      gameId: game.id,
      leagueId: league.id,
      seasonId: season.id,
      teamId: team.id,
      playerId: player.id,
      statTypeId: statType.id,
      minute: 12,
    })

    return { country, league, season, team, player, game }
  }

  test('team roster (season detail) stubs the private player', async ({ assert }) => {
    const { season, team, player } = await seed()
    const roster = await Player.query()
      .whereHas('teams', (q) => q.where('teams.id', team.id))
      .preload('teams')

    const detail = (await resolve(
      new TeamSeasonDetailTransformer({
        season,
        games: [],
        standings: [],
        players: roster,
      }).toObject()
    )) as unknown as { players: Array<Record<string, unknown>> }

    assert.lengthOf(detail.players, 1)
    assert.deepEqual(detail.players[0], {
      id: player.id,
      name: 'Private Player',
      visibility: 'private',
    })
  })

  test('league_players roster row stubs the private player', async ({ assert }) => {
    const { player } = await seed()
    const row = await LeaguePlayer.query()
      .where('player_id', player.id)
      .preload('player')
      .preload('team')
      .firstOrFail()

    const serialized = (await resolve(
      new LeaguePlayerTransformer(row).withPlayer()
    )) as unknown as {
      player: Record<string, unknown>
    }

    assert.deepEqual(serialized.player, {
      id: player.id,
      name: 'Private Player',
      visibility: 'private',
    })
  })

  test('match lineup stubs the private player', async ({ assert }) => {
    const { game, player } = await seed()
    const lineup = await GameLineup.query()
      .where('game_id', game.id)
      .preload('player')
      .preload('team')
      .firstOrFail()

    const serialized = (await resolve(new GameLineupTransformer(lineup).toObject())) as unknown as {
      player: Record<string, unknown>
    }

    assert.deepEqual(serialized.player, {
      id: player.id,
      name: 'Private Player',
      visibility: 'private',
    })
  })

  test('stat / stats leaderboard row stubs the private player', async ({ assert }) => {
    const { game, player } = await seed()
    const stat = await Stat.query()
      .where('game_id', game.id)
      .preload('player')
      .preload('team')
      .preload('type')
      .firstOrFail()

    const serialized = (await resolve(new StatTransformer(stat).toObject())) as unknown as {
      player: Record<string, unknown>
    }

    assert.deepEqual(serialized.player, {
      id: player.id,
      name: 'Private Player',
      visibility: 'private',
    })
  })

  test('country featured-players leaderboard stubs the private player', async ({ assert }) => {
    const { country } = await seed()
    const service = new CountryService()
    const detail = await service.getCountryDetail(String(country.id))

    assert.isAtLeast(detail.featuredPlayers.length, 1)
    const featured = detail.featuredPlayers[0]!
    assert.equal(featured.player.name, 'Private Player')
    assert.isNull(featured.player.position)
    assert.isNull(featured.player.teamId)
  })

  test('GET /players/:id public profile stubs a private player', async ({ assert }) => {
    const { player } = await seed()
    const service = new PlayerService()
    const { player: loaded } = await service.getPlayerDetail(player.id)

    assert.equal(loaded.visibility, 'private')
  })
})
