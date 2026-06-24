type TimeZoneRequest = {
  header(name: string): string | undefined
}

/**
 * Resolves the user's IANA timezone for match-day filtering.
 * Query param wins; otherwise checks standard/custom request headers.
 */
export function resolveRequestTimeZone(
  queryTimeZone: string | undefined,
  request: TimeZoneRequest
): string | undefined {
  const fromQuery = queryTimeZone?.trim()
  if (fromQuery) {
    return fromQuery
  }

  for (const name of ['time-zone', 'x-timezone', 'timezone'] as const) {
    const value = request.header(name)?.trim()
    if (value) {
      return value
    }
  }

  return undefined
}
