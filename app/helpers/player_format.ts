/**
 * Builds display initials from a player or user name.
 */
export function avatarInitialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) {
    return '?'
  }
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
  }
  return parts[0]!.slice(0, 2).toUpperCase()
}

const POSITION_LABELS: Record<string, string> = {
  attack: 'Attacker',
  defence: 'Defender',
  midfield: 'Midfielder',
  goalkeeper: 'Goalkeeper',
}

export function formatPlayerPosition(position: string | null | undefined): string | null {
  if (!position) {
    return null
  }
  return POSITION_LABELS[position] ?? position
}
