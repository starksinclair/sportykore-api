import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

const rosterStatuses = ['active', 'transferred', 'injured', 'suspended'] as const

export const rosterPositions = ['attack', 'defence', 'midfield', 'goalkeeper'] as const

export type RosterPosition = (typeof rosterPositions)[number]

const dateFormats = ['iso8601', 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss']

export const createLeaguePlayerValidator = vine.create({
  leagueId: resourceId('leagues'),
  playerId: resourceId('players'),
  seasonId: resourceId('seasons'),
  teamId: resourceId('teams'),
  jerseyNumber: vine.string().trim().maxLength(5).nullable().optional(),
  status: vine.enum(rosterStatuses).optional(),
  isCaptain: vine.boolean().optional(),
  position: vine.enum(rosterPositions).nullable().optional(),
  joinedAt: vine.date({ formats: dateFormats }).optional(),
  leftAt: vine.date({ formats: dateFormats }).nullable().optional(),
})

export const updateLeaguePlayerValidator = vine.create({
  jerseyNumber: vine.string().trim().maxLength(5).nullable().optional(),
  status: vine.enum(rosterStatuses).optional(),
  isCaptain: vine.boolean().optional(),
  position: vine.enum(rosterPositions).nullable().optional(),
  joinedAt: vine.date({ formats: dateFormats }).optional(),
  leftAt: vine.date({ formats: dateFormats }).nullable().optional(),
})

export const acceptLeaguePlayerRequestValidator = vine.create({
  playerId: resourceId('players'),
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
})
