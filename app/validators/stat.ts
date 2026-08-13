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
  isPenalty: vine.boolean().optional(),
  value: vine.string().trim().maxLength(500).nullable().optional(),
  numericValue: vine.number().withoutDecimals().min(0).max(999).optional(),
})

export const updateStatValidator = vine.create({
  relatedPlayerId: resourceId('players').nullable().optional(),
  minute: vine.number().withoutDecimals().min(0).max(130).nullable().optional(),
  isStoppageTime: vine.boolean().optional(),
  isPenalty: vine.boolean().optional(),
  value: vine.string().trim().maxLength(500).nullable().optional(),
  numericValue: vine.number().withoutDecimals().min(0).max(999).optional(),
})

const substitutionSwap = vine.object({
  playerOffId: resourceId('players'),
  playerOnId: resourceId('players'),
  minute: vine.number().withoutDecimals().min(0).max(130),
  isStoppageTime: vine.boolean().optional(),
})

/** Atomic create of paired substitution_off + substitution_on rows (one or more swaps). */
export const recordSubstitutionValidator = vine.create({
  gameId: resourceId('games'),
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
  teamId: resourceId('teams'),
  substitutions: vine.array(substitutionSwap).minLength(1).maxLength(11),
})

const trackingEvent = vine.object({
  clientEventId: vine.string().uuid(),
  type: vine.enum(['pass', 'shot']),
  teamId: resourceId('teams'),
  playerId: resourceId('players'),
  minute: vine.number().withoutDecimals().min(0).max(130).nullable().optional(),
  isStoppageTime: vine.boolean().optional(),
  completed: vine.boolean().optional(),
  onTarget: vine.boolean().optional(),
})

export const recordTrackingEventsValidator = vine.create({
  events: vine.array(trackingEvent).minLength(1).maxLength(250),
})
