import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'
import { GAME_STATUSES } from '#types/game_status'

const dateFormats = ['iso8601', 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss']

export const createGameValidator = vine.create({
  leagueId: resourceId('leagues'),
  seasonId: resourceId('seasons'),
  homeTeamId: resourceId('teams'),
  awayTeamId: resourceId('teams'),
  playedAt: vine.date({ formats: dateFormats }),
  homeScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  awayScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  firstHalfDuration: vine.number().withoutDecimals().min(1).max(120).optional(),
  secondHalfDuration: vine.number().withoutDecimals().min(1).max(120).optional(),
  extraTimeDuration: vine.number().withoutDecimals().min(1).max(60).nullable().optional(),
  status: vine.enum(GAME_STATUSES).optional(),
  venueName: vine.string().trim().maxLength(255).nullable().optional(),
})

export const updateGameValidator = vine.create({
  homeScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  awayScore: vine.number().withoutDecimals().min(0).max(99).nullable().optional(),
  firstHalfDuration: vine.number().withoutDecimals().min(1).max(120).optional(),
  secondHalfDuration: vine.number().withoutDecimals().min(1).max(120).optional(),
  extraTimeDuration: vine.number().withoutDecimals().min(1).max(60).nullable().optional(),
  status: vine.enum(GAME_STATUSES).optional(),
  playedAt: vine.date({ formats: dateFormats }).optional(),
  venueName: vine.string().trim().maxLength(255).nullable().optional(),
})
