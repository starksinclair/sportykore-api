import vine from '@vinejs/vine'

export const requestOtpValidator = vine.create({
  email: vine.string().email(),
  name: vine.string().optional(),
  recoveryEmail: vine
    .string()
    .email()
    .unique({ table: 'users', column: 'recovery_email' })
    .optional(),
})

export const verifyOtpValidator = vine.create({
  email: vine.string().email().exists({ table: 'users', column: 'email' }),
  code: vine.string().minLength(6).maxLength(6),
})

export const requestRecoveryValidator = vine.create({
  recoveryEmail: vine.string().email().exists({ table: 'users', column: 'recovery_email' }),
})
