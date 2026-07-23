import env from '#start/env'

/**
 * Store-reviewer OTP bypass helpers.
 * Strict equality only — no domain wildcards or partial matches.
 */
function configuredEmails(): { admin?: string; player?: string } {
  return {
    admin: env.get('REVIEW_ADMIN_EMAIL'),
    player: env.get('REVIEW_PLAYER_EMAIL'),
  }
}

function configuredOtpCode(): string | undefined {
  return env.get('REVIEW_OTP_CODE')
}

/**
 * Bypass is active only when the flag is true and all required values are set.
 * Incomplete config never enables the bypass.
 */
export function isReviewAccountEnabled(): boolean {
  if (env.get('REVIEW_ACCOUNT_ENABLED') !== true) {
    return false
  }

  const { admin, player } = configuredEmails()
  const code = configuredOtpCode()

  if (!admin || !player || !code) {
    return false
  }

  if (!/^\d{6}$/.test(code)) {
    return false
  }

  return true
}

/** True when email exactly equals one of the two configured reviewer emails. */
export function isReviewerEmail(email: string): boolean {
  if (!isReviewAccountEnabled()) {
    return false
  }

  const { admin, player } = configuredEmails()
  return email === admin || email === player
}

/** True when enabled, email is a reviewer, and code exactly equals REVIEW_OTP_CODE. */
export function isReviewerOtp(email: string, code: string): boolean {
  if (!isReviewerEmail(email)) {
    return false
  }

  return code === configuredOtpCode()
}
