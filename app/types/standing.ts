export const ZONE_TYPES = [
  'promotion',
  'promotion_playoff',
  'playoff',
  'relegation_playoff',
  'relegation',
  'qualified',
] as const

export type ZoneType = (typeof ZONE_TYPES)[number]
