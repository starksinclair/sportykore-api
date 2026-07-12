import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'
import { LINEUP_POSITIONS, LINEUP_STATUSES } from '#types/formation'

const lineupStarter = vine.object({
  playerId: resourceId('players'),
  slotKey: vine.string().trim().minLength(1).maxLength(32),
  jerseyNumber: vine.number().withoutDecimals().min(1).max(99).optional(),
})

const lineupSubstitute = vine.object({
  playerId: resourceId('players'),
  jerseyNumber: vine.number().withoutDecimals().min(1).max(99).optional(),
})

export const setLineupValidator = vine.create({
  teamId: resourceId('teams'),
  formationId: resourceId('formations'),
  starters: vine.array(lineupStarter).minLength(11).maxLength(11),
  substitutes: vine.array(lineupSubstitute).maxLength(12),
})

export const updateLineupValidator = vine.create({
  jerseyNumber: vine.number().withoutDecimals().min(1).max(99).nullable().optional(),
  slotKey: vine.string().trim().minLength(1).maxLength(32).nullable().optional(),
  position: vine.enum(LINEUP_POSITIONS).nullable().optional(),
  status: vine.enum(LINEUP_STATUSES).optional(),
})
