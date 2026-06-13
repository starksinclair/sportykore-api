import vine from '@vinejs/vine'

export const endGameValidator = vine.create({
  homeScore: vine.number().withoutDecimals().min(0).max(99),
  awayScore: vine.number().withoutDecimals().min(0).max(99),
})
