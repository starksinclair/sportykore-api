import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

const gameStatuses = ['scheduled', 'live', 'break', 'completed', 'postponed', 'cancelled'] as const

const dateFormats = ['iso8601', 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss']

export const createGameValidator = vine.create({
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
  homeTeamId: resourceId('teams'),
  awayTeamId: resourceId('teams'),
  playedAt: vine.date({ formats: dateFormats }),
  homeScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  awayScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  currentMinute: vine.number().withoutDecimals().min(0).max(130).optional(),
  status: vine.enum(gameStatuses).optional(),
  venueName: vine.string().trim().maxLength(255).nullable().optional(),
})

export const updateGameValidator = vine.create({
  homeScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  awayScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  currentMinute: vine.number().withoutDecimals().min(0).max(130).optional(),
  status: vine.enum(gameStatuses).optional(),
  playedAt: vine.date({ formats: dateFormats }).optional(),
  venueName: vine.string().trim().maxLength(255).nullable().optional(),
})
