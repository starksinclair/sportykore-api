import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

export const pushPlatformValues = ['ios', 'android', 'web', 'unknown'] as const

export const registerPushTokenValidator = vine.create({
  provider: vine.enum(['expo']).optional(),
  token: vine.string().trim().maxLength(255),
  platform: vine.enum(pushPlatformValues).optional(),
  deviceId: vine.string().trim().maxLength(128).nullable().optional(),
})

export const leagueNotificationPreferenceParamsValidator = vine.create({
  leagueId: resourceId('leagues'),
})

export const updateLeagueNotificationPreferenceValidator = vine.create({
  enabled: vine.boolean(),
})
