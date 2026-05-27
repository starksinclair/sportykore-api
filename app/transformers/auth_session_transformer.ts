import type { AccessToken } from '@adonisjs/auth/access_tokens'
import { BaseTransformer } from '@adonisjs/core/transformers'

import type User from '#models/user'

export type AuthSessionInput = {
  user: User
  accessToken: AccessToken
}

export default class AuthSessionTransformer extends BaseTransformer<AuthSessionInput> {
  toObject() {
    const { user, accessToken } = this.resource
    if (!accessToken.value) {
      throw new Error('Access token is missing a releasable secret')
    }
    const value = accessToken.value.release()
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token: {
        type: 'bearer' as const,
        value,
        expiresAt: accessToken.expiresAt ? accessToken.expiresAt.toISOString() : null,
        abilities: accessToken.abilities,
      },
    }
  }
}
