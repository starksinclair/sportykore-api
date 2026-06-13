import vine from '@vinejs/vine'

export const updateGameScoreValidator = vine.create({
  team: vine.enum(['home', 'away']),
  action: vine.enum(['increment', 'decrement']),
})

export const accreditStatValidator = vine.create({
  playerId: vine.number().withoutDecimals().positive(),
  assistPlayerId: vine.number().withoutDecimals().positive().nullable().optional(),
  isOwnGoal: vine.boolean(),
  minute: vine.number().withoutDecimals().min(0).max(130),
})
