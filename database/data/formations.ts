import type { FormationDefinition, FormationSlot, LineupPosition } from '#types/formation'

type SlotRow = Array<LineupPosition>

function buildSlots(rows: SlotRow[]): FormationSlot[] {
  const slots: FormationSlot[] = []
  const counters: Partial<Record<LineupPosition, number>> = {}

  for (let line = 0; line < rows.length; line++) {
    const row = rows[line]
    for (let order = 0; order < row.length; order++) {
      const position = row[order]
      counters[position] = (counters[position] ?? 0) + 1
      slots.push({
        key: `${position}_${counters[position]}`,
        position,
        line,
        order: order + 1,
        label: position,
      })
    }
  }

  return slots
}

function formation(name: string, displayName: string, rows: SlotRow[]): FormationDefinition {
  return { name, displayName, slots: buildSlots(rows) }
}

const backFour: SlotRow = ['RB', 'CB', 'CB', 'LB']
const threeCb: SlotRow = ['CB', 'CB', 'CB']
const fiveBack: SlotRow = ['RWB', 'CB', 'CB', 'CB', 'LWB']

export const formations: FormationDefinition[] = [
  formation('4-3-3', '4-3-3', [
    ['GK'],
    backFour,
    ['CM', 'CM', 'CM'],
    ['RW', 'ST', 'LW'],
  ]),
  formation('4-4-2', '4-4-2', [
    ['GK'],
    backFour,
    ['RM', 'CM', 'CM', 'LM'],
    ['ST', 'ST'],
  ]),
  formation('4-2-3-1', '4-2-3-1', [
    ['GK'],
    backFour,
    ['CDM', 'CDM'],
    ['RW', 'CAM', 'LW'],
    ['ST'],
  ]),
  formation('3-5-2', '3-5-2', [
    ['GK'],
    threeCb,
    ['RWB', 'CM', 'CM', 'CM', 'LWB'],
    ['ST', 'ST'],
  ]),
  formation('4-4-1-1', '4-4-1-1', [
    ['GK'],
    backFour,
    ['RM', 'CM', 'CM', 'LM'],
    ['CAM'],
    ['ST'],
  ]),
  formation('4-1-2-1-2', '4-1-2-1-2 (Diamond)', [
    ['GK'],
    backFour,
    ['CDM'],
    ['RM', 'LM'],
    ['CAM'],
    ['ST', 'ST'],
  ]),
  formation('4-1-3-2', '4-1-3-2', [
    ['GK'],
    backFour,
    ['CDM'],
    ['LM', 'CM', 'RM'],
    ['ST', 'ST'],
  ]),
  formation('4-2-2-2', '4-2-2-2 (Magic Rectangle)', [
    ['GK'],
    backFour,
    ['CDM', 'CDM'],
    ['LM', 'RM'],
    ['ST', 'ST'],
  ]),
  formation('4-2-4', '4-2-4', [
    ['GK'],
    backFour,
    ['CM', 'CM'],
    ['LW', 'ST', 'ST', 'RW'],
  ]),
  formation('4-1-4-1', '4-1-4-1', [
    ['GK'],
    backFour,
    ['CDM'],
    ['LM', 'CM', 'CM', 'RM'],
    ['ST'],
  ]),
  formation('4-3-2-1', '4-3-2-1 (Christmas Tree)', [
    ['GK'],
    backFour,
    ['LM', 'CDM', 'RM'],
    ['CAM', 'CAM'],
    ['ST'],
  ]),
  formation('4-5-1', '4-5-1', [
    ['GK'],
    backFour,
    ['LM', 'CDM', 'CM', 'CM', 'RM'],
    ['ST'],
  ]),
  formation('4-6-0', '4-6-0 (False Nine)', [
    ['GK'],
    backFour,
    ['LM', 'CDM', 'CM', 'CM', 'CDM', 'RM'],
  ]),
  formation('3-4-3', '3-4-3', [
    ['GK'],
    threeCb,
    ['LM', 'CM', 'CM', 'RM'],
    ['LW', 'ST', 'RW'],
  ]),
  formation('3-4-2-1', '3-4-2-1', [
    ['GK'],
    threeCb,
    ['LM', 'CM', 'CM', 'RM'],
    ['CAM', 'CAM'],
    ['ST'],
  ]),
  formation('3-4-1-2', '3-4-1-2', [
    ['GK'],
    threeCb,
    ['LM', 'CM', 'CM', 'RM'],
    ['CAM'],
    ['ST', 'ST'],
  ]),
  formation('3-2-4-1', '3-2-4-1', [
    ['GK'],
    threeCb,
    ['CDM', 'CDM'],
    ['LW', 'CAM', 'CAM', 'RW'],
    ['ST'],
  ]),
  formation('3-1-3-3', '3-1-3-3', [
    ['GK'],
    threeCb,
    ['CDM'],
    ['LM', 'CM', 'RM'],
    ['LW', 'ST', 'RW'],
  ]),
  formation('3-5-1-1', '3-5-1-1', [
    ['GK'],
    threeCb,
    ['RWB', 'CM', 'CM', 'CM', 'LWB'],
    ['CAM'],
    ['ST'],
  ]),
  formation('5-3-2', '5-3-2', [
    ['GK'],
    fiveBack,
    ['CM', 'CM', 'CM'],
    ['ST', 'ST'],
  ]),
  formation('5-4-1', '5-4-1', [
    ['GK'],
    fiveBack,
    ['LM', 'CM', 'CM', 'RM'],
    ['ST'],
  ]),
  formation('5-2-2-1', '5-2-2-1', [
    ['GK'],
    fiveBack,
    ['CDM', 'CDM'],
    ['CAM', 'CAM'],
    ['ST'],
  ]),
  formation('4-2-1-3', '4-2-1-3', [
    ['GK'],
    backFour,
    ['CDM', 'CDM'],
    ['CAM'],
    ['LW', 'ST', 'RW'],
  ]),
  formation('4-3-1-2', '4-3-1-2', [
    ['GK'],
    backFour,
    ['CM', 'CM', 'CM'],
    ['CAM'],
    ['ST', 'ST'],
  ]),
  formation('3-6-1', '3-6-1', [
    ['GK'],
    threeCb,
    ['LM', 'CDM', 'CM', 'CM', 'CDM', 'RM'],
    ['ST'],
  ]),
]
