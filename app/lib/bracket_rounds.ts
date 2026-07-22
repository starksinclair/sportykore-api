import type { BracketRound, ProgressionRound } from '#types/stage'

export const ROUND_SIZE: Record<Exclude<BracketRound, 'third_place'>, number> = {
  r256: 256,
  r128: 128,
  r64: 64,
  r32: 32,
  r16: 16,
  qf: 8,
  sf: 4,
  final: 2,
}

export function roundSize(round: BracketRound): number {
  if (round === 'third_place') {
    return 2
  }
  return ROUND_SIZE[round]
}

export function roundFromSize(n: number): ProgressionRound {
  const entry = Object.entries(ROUND_SIZE).find(([, size]) => size === n)
  if (!entry) {
    throw new Error(`No bracket round for size ${n}`)
  }
  return entry[0] as ProgressionRound
}

export function nextRound(round: BracketRound): ProgressionRound {
  if (round === 'third_place' || round === 'final') {
    throw new Error(`No next round after ${round}`)
  }
  return roundFromSize(roundSize(round) / 2)
}

export function nextPow2(n: number): number {
  if (n < 1) {
    throw new Error('Team count must be at least 1')
  }
  let p = 1
  while (p < n) {
    p *= 2
  }
  return p
}

export function targetWins(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1
}
