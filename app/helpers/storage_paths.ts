import string from '@adonisjs/core/helpers/string'

type NamedEntity = {
  id: number
  name: string | null | undefined
}

function slugify(value: string | null | undefined, fallback: string): string {
  const slug = (value ?? fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || fallback
}

function extension(extname: string | null | undefined): string {
  return (extname ?? 'bin').replace(/^\.+/, '').toLowerCase()
}

export function leagueFolder(league: NamedEntity): string {
  return `leagues/${league.id}-${slugify(league.name, 'league')}`
}

export function teamFolder(league: NamedEntity, team: NamedEntity): string {
  return `${leagueFolder(league)}/teams/${team.id}-${slugify(team.name, 'team')}`
}

export function leagueLogoKey(league: NamedEntity, extname: string | null | undefined): string {
  return `${leagueFolder(league)}/logo/${string.uuid()}.${extension(extname)}`
}

export function teamLogoKey(
  league: NamedEntity,
  team: NamedEntity,
  extname: string | null | undefined
): string {
  return `${teamFolder(league, team)}/logo/${string.uuid()}.${extension(extname)}`
}

export function playerAvatarKey(player: NamedEntity, extname: string | null | undefined): string {
  return `players/${player.id}-${slugify(player.name, 'player')}/avatar/${string.uuid()}.${extension(
    extname
  )}`
}
