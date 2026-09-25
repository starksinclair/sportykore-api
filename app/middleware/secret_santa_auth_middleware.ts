import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Session key set once the /secret-santa dashboard password has been
 * accepted. Shared with the controller so `index`/`login`/`logout` (which
 * render the login page inline rather than redirecting) can read/write it.
 */
export const SECRET_SANTA_SESSION_KEY = 'secret_santa_unlocked'

/**
 * Gates every /secret-santa action route behind the dashboard session flag,
 * so a new route can't ship without the check the way a hand-copied
 * per-handler guard could be forgotten.
 */
export default class SecretSantaAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.session.get(SECRET_SANTA_SESSION_KEY) !== true) {
      return ctx.response.redirect('/secret-santa')
    }

    return next()
  }
}
