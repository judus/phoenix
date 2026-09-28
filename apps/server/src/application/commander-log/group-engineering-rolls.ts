import type { CommanderLogEntry } from '@phoenix/contracts'

// Presentation only: persisted events remain idempotent and individually inspectable.
export function groupEngineeringRolls (newestFirst: CommanderLogEntry[]): CommanderLogEntry[] {
  const result: CommanderLogEntry[] = []
  let group: CommanderLogEntry[] = []
  const flush = () => {
    const latest = group.at(-1)
    if (!latest) return
    const first = group[0]!
    const roll = latest.engineeringRoll!
    result.push(group.length === 1 ? latest : {
      ...latest,
      title: 'Engineering applied',
      detail: [
        roll.blueprint, roll.module,
        first.engineeringRoll!.grade === roll.grade ? `Grade ${roll.grade}` : `Grade ${first.engineeringRoll!.grade} → ${roll.grade}`,
        `${group.length} rolls`, roll.engineer
      ].join(' · ')
    })
    group = []
  }
  for (const entry of [...newestFirst].reverse()) {
    const previous = group.at(-1)
    const gap = previous ? Date.parse(entry.timestamp) - Date.parse(previous.timestamp) : 0
    if (!entry.engineeringRoll) {
      flush()
      result.push(entry)
    } else {
      if (previous && (previous.engineeringRoll?.key !== entry.engineeringRoll.key || gap < 0 || gap > 5 * 60_000)) flush()
      group.push(entry)
    }
  }
  flush()
  return result.reverse()
}
