import vine from '@vinejs/vine'

import { resourceId } from '#validators/common'

export const setMotmAwardValidator = vine.create({
  playerId: resourceId('players'),
})
