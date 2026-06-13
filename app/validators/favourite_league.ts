import vine from '@vinejs/vine'
import { resourceId } from '#validators/common'

export const favouriteLeagueParamsValidator = vine.create({
  leagueId: resourceId('leagues'),
})
