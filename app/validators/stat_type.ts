import vine from '@vinejs/vine'

const statCategories = ['performance', 'discipline', 'substitution'] as const

export const createStatTypeValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120),
  displayName: vine.string().trim().minLength(1).maxLength(160),
  iconName: vine.string().trim().maxLength(120).nullable().optional(),
  category: vine.enum(statCategories).optional(),
})

export const updateStatTypeValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120).optional(),
  displayName: vine.string().trim().minLength(1).maxLength(160).optional(),
  iconName: vine.string().trim().maxLength(120).nullable().optional(),
  category: vine.enum(statCategories).optional(),
})
