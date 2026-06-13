import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import string from '@adonisjs/core/helpers/string'
import { DateTime } from 'luxon'
import Invite from '#models/invite'
import Player from '#models/player'
import LeaguePlayer from '#models/league_player'
import FileService from '#services/file_service'

@inject()
export default class InviteService {
  constructor(private fileService: FileService) {}

  async generate(leagueId: number, seasonId: number, teamId?: number, invitedUserId?: number) {
    const token = crypto.randomUUID()

    await Invite.create({
      token,
      leagueId,
      seasonId,
      teamId,
      invitedUserId: invitedUserId ?? null,
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })
    return `/join/${token}`
  }

  async accept(token: string, userId: number) {
    const invite = await Invite.query()
      .where('token', token)
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL())
      .firstOrFail()

    // if the invite is for a specific user, make sure it's them
    if (invite.invitedUserId && invite.invitedUserId !== userId) {
      throw new Exception('This invite is not for you', { status: 403 })
    }

    // check if a user has a player profile
    const player = await Player.query().where('user_id', userId).first()

    if (!player) {
      return { requiresProfile: true, token }
    }

    // check if a player is already in this team for this season
    const alreadyJoined = await LeaguePlayer.query()
      .where('player_id', player.id)
      .where('season_id', invite.seasonId)
      .if(invite.teamId !== null, (query) => query.where('team_id', invite.teamId!))
      .first()

    if (alreadyJoined) {
      throw new Exception('You are already in this team for this season', { status: 409 })
    }

    if (invite.leagueId) {
      await LeaguePlayer.create({
        playerId: player.id,
        leagueId: invite.leagueId,
        seasonId: invite.seasonId,
        teamId: invite.teamId,
      })
    }

    invite.status = 'accepted'
    invite.acceptedAt = DateTime.now()
    await invite.save()

    return { requiresProfile: false, leagueId: invite.leagueId }
  }

  async completeProfileAndAccept(
    token: string,
    userId: number,
    profileData: {
      name: string
      countryId: number
      bio?: string | null
      avatar?: MultipartFile
    }
  ) {
    // make sure the user doesn't already have a player profile
    const existing = await Player.query().where('user_id', userId).first()

    if (existing) {
      console.log('Player profile already exists', existing)
      throw new Exception('Player profile already exists', { status: 409 })
    }

    let avatarUrl: string | null = null

    if (profileData.avatar) {
      const key = `players/${string.uuid()}.${profileData.avatar.extname}`
      avatarUrl = await this.fileService.upload(profileData.avatar, key, 'fs')
    }

    await Player.create({
      userId,
      name: profileData.name,
      countryId: profileData.countryId,
      bio: profileData.bio ?? null,
      avatarUrl,
    })

    return this.accept(token, userId)
  }
}
