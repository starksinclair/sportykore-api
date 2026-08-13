import vine from '@vinejs/vine'

export const bugReportValidator = vine.create({
  type: vine
    .enum(['bug', 'confusing_flow', 'feature_request', 'account_access', 'other'] as const)
    .optional(),
  title: vine.string().trim().minLength(3).maxLength(140),
  description: vine.string().trim().minLength(10).maxLength(4000),
  expected: vine.string().trim().maxLength(2000).optional(),
  email: vine.string().trim().email().optional(),
  route: vine.string().trim().maxLength(255).optional(),
  appVersion: vine.string().trim().maxLength(80).optional(),
  platform: vine.string().trim().maxLength(80).optional(),
  osVersion: vine.string().trim().maxLength(80).optional(),
  deviceModel: vine.string().trim().maxLength(120).optional(),
})
