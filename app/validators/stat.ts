import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

export const createStatValidator = vine.create({
  gameId: resourceId('games'),
  playerId: resourceId('players'),
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
  teamId: resourceId('teams'),
  statTypeId: resourceId('stat_types'),
  relatedPlayerId: resourceId('players').nullable().optional(),
  minute: vine.number().withoutDecimals().min(0).max(130).nullable().optional(),
  isStoppageTime: vine.boolean().optional(),
  value: vine.string().trim().maxLength(500).nullable().optional(),
  numericValue: vine.number().withoutDecimals().min(0).max(999).optional(),
})

export const updateStatValidator = vine.create({
  relatedPlayerId: resourceId('players').nullable().optional(),
  minute: vine.number().withoutDecimals().min(0).max(130).nullable().optional(),
  isStoppageTime: vine.boolean().optional(),
  value: vine.string().trim().maxLength(500).nullable().optional(),
  numericValue: vine.number().withoutDecimals().min(0).max(999).optional(),
})
