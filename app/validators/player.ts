import vine from '@vinejs/vine'
import { optionalHttpUrlNullable, optionalResourceId, resourceId } from '#validators/common'

export const createPlayerValidator = vine.create({
  userId: resourceId('users'),
  name: vine.string().trim().minLength(1).maxLength(255).nullable().optional(),
  bio: vine.string().trim().maxLength(2000).nullable().optional(),
  avatarUrl: optionalHttpUrlNullable(),
  addedBy: optionalResourceId('users'),
})

export const updatePlayerValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).nullable().optional(),
  bio: vine.string().trim().maxLength(2000).nullable().optional(),
  avatarUrl: optionalHttpUrlNullable(),
  addedBy: optionalResourceId('users'),
})
