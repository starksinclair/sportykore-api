import type { DateTime } from 'luxon'

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'NS',
  first_half: 'LIVE',
  half_time: 'HT',
  second_half: 'LIVE',
  extra_time: 'LIVE',
  full_time: 'FT',
  paused: 'PAUSED',
  postponed: 'PP',
  cancelled: 'CANC',
}

export function formatMatchStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return 'NS'
  }
  return STATUS_LABELS[status] ?? status.toUpperCase()
}

export function formatScoreline(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined
): string {
  if (
    homeScore === null ||
    homeScore === undefined ||
    awayScore === null ||
    awayScore === undefined
  ) {
    return '-'
  }
  return `${homeScore} - ${awayScore}`
}

export function formatKickoffLabel(playedAt: DateTime): string {
  return playedAt.toFormat('EEE, d MMM')
}

export function formatIsoDate(playedAt: DateTime): string {
  return playedAt.toISODate() ?? playedAt.toFormat('yyyy-MM-dd')
}
