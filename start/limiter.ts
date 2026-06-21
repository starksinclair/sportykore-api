/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from '@adonisjs/limiter/services/main'
import { HttpContext } from '@adonisjs/core/http'

// general API — applies to all routes
export const globalThrottle = limiter.define('global', (ctx: HttpContext) => {
  // authenticated users get more requests
  if (ctx.auth.user) {
    return limiter.allowRequests(120).every('1 minute').usingKey(`user_${ctx.auth.user.id}`)
  }

  // guests get less
  return limiter.allowRequests(30).every('1 minute').usingKey(`ip_${ctx.request.ip()}`)
})

// strict — for auth endpoints (login, register)
export const authThrottle = limiter.define('auth', (ctx: HttpContext) => {
  return limiter
    .allowRequests(5)
    .every('1 minute')
    .blockFor('15 mins') // block for 15 mins after 5 failed attempts
    .usingKey(`auth_${ctx.request.ip()}`)
    .limitExceeded((error: any) => {
      error
        .setStatus(429)
        .setMessage(`Too many attempts. Try again in ${error.response.availableIn} seconds`)
    })
})

// invite generation — prevent spam
export const inviteThrottle = limiter.define('invite', (ctx: HttpContext) => {
  return limiter
    .allowRequests(10)
    .every('1 hour')
    .usingKey(`invite_${ctx.auth.user!.id}`)
    .limitExceeded((error: any) => {
      error.setStatus(429).setMessage('Too many invites generated. Try again in an hour')
    })
})

// score/stat updates — prevent abuse during live games
export const gameUpdateThrottle = limiter.define('game_update', (ctx: HttpContext) => {
  return limiter
    .allowRequests(60)
    .every('1 minute')
    .usingKey(`game_update_${ctx.auth.user!.id}`)
    .limitExceeded((error: any) => {
      error.setStatus(429).setMessage('Slow down — too many game updates')
    })
})

// search — prevent scraping
export const searchThrottle = limiter.define('search', (ctx: HttpContext) => {
  if (ctx.auth.user) {
    return limiter.allowRequests(60).every('1 minute').usingKey(`search_${ctx.auth.user.id}`)
  }

  return limiter.allowRequests(20).every('1 minute').usingKey(`search_ip_${ctx.request.ip()}`)
})

// prevent OTP spam — max 3 requests per 10 minutes per email
export const otpRequestThrottle = limiter.define('otp_request', (ctx: HttpContext) => {
  const email = ctx.request.body().email ?? ctx.request.ip()
  return limiter
    .allowRequests(5)
    .every('10 mins')
    .usingKey(`otp_request_${email}`)
    .blockFor('30 mins')
    .limitExceeded((error: any) => {
      error.setMessage(`Too many OTP requests. Try again in ${error.response.availableIn} seconds`)
    })
})

// prevent brute force guessing — max 5 attempts per 10 minutes
export const otpVerifyThrottle = limiter.define('otp_verify', (ctx: HttpContext) => {
  const email = ctx.request.body().email ?? ctx.request.ip()
  return limiter
    .allowRequests(5)
    .every('10 mins')
    .usingKey(`otp_verify_${email}`)
    .blockFor('30 mins')
    .limitExceeded((error: any) => {
      error.setMessage(
        `Too many failed attempts. Try again in ${error.response.availableIn} seconds`
      )
    })
})
