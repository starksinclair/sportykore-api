export const LINEUP_POSITIONS = [
  'GK',
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'CF',
  'ST',
  'SS',
] as const

export const LINEUP_STATUSES = ['starter', 'substitute', 'did_not_play'] as const

export type LineupPosition = (typeof LINEUP_POSITIONS)[number]
export type LineupStatus = (typeof LINEUP_STATUSES)[number]

export type FormationSlot = {
  key: string
  position: LineupPosition
  line: number
  order: number
  label: string
}

export type FormationDefinition = {
  name: string
  displayName: string
  slots: FormationSlot[]
}
