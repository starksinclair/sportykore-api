import vine from '@vinejs/vine'

/**
 * Shared rules for email and password.
 */
const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

/**
 * Validator to use when performing self-signup
 */
export const signupValidator = vine.create({
  fullName: vine.string().nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password().minLength(8).maxLength(32),
})

/**
 * Session / credential login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string().minLength(1).maxLength(255),
})

/**
 * Update own profile (password optional; hashed by model hook when present)
 */
export const forgotPasswordValidator = vine.create({
  email: email(),
})

export const resetPasswordValidator = vine.create({
  token: vine.string().trim().minLength(32).maxLength(128),
  password: password().confirmed({
    confirmationField: 'passwordConfirmation',
  }),
})
