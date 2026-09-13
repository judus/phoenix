import {
  COMMANDER_RANK_NAMES,
  type CommanderLogEntry
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import {
  commanderLogEntry,
  detail,
  journalInteger,
  journalLabel,
  journalText
} from './commander-log-event.js'

const promotionRanks = [
  ['Combat', 'Combat', 'combat'],
  ['Trade', 'Trade', 'trade'],
  ['Explore', 'Exploration', 'exploration'],
  ['CQC', 'CQC', 'cqc'],
  ['Soldier', 'Mercenary', 'mercenary'],
  ['Exobiologist', 'Exobiologist', 'exobiologist'],
  ['Federation', 'Federation', 'federation'],
  ['Empire', 'Empire', 'empire']
] as const

export function projectCareerCommanderLogEntry (event: EliteJournalEvent): CommanderLogEntry | null {
  if (event.event === 'Promotion') return promotion(event)
  if (event.event === 'EngineerProgress') return engineerProgress(event)
  if (event.event === 'EngineerCraft') return engineerCraft(event)
  return null
}

function promotion (event: EliteJournalEvent): CommanderLogEntry | null {
  const rank = promotionRanks.flatMap(([key, discipline, contractKey]) => {
    const level = journalInteger(event, key)
    return level === null ? [] : [{
      discipline,
      level: COMMANDER_RANK_NAMES[contractKey][level] ?? `Rank ${level}`
    }]
  })[0]
  if (!rank) return null
  return commanderLogEntry(event, {
    category: 'career',
    kind: 'career.promoted',
    title: `${rank.discipline} rank advanced`,
    detail: rank.level,
    creditDelta: null,
    tone: 'positive'
  })
}

function engineerProgress (event: EliteJournalEvent): CommanderLogEntry | null {
  if (Array.isArray(event.Engineers)) return null
  const engineer = journalText(event, 'Engineer')
  if (!engineer) return null
  const status = journalText(event, 'Progress')
  const rank = journalInteger(event, 'Rank')
  return commanderLogEntry(event, {
    category: 'engineering',
    kind: 'engineering.access_changed',
    title: 'Engineer access changed',
    detail: detail(engineer, status, rank === null ? null : `Grade ${rank}`),
    creditDelta: null,
    tone: status?.toLocaleLowerCase() === 'barred' ? 'warning' : 'positive'
  })
}

function engineerCraft (event: EliteJournalEvent): CommanderLogEntry | null {
  const blueprint = journalLabel(event, 'BlueprintName')
  const effect = journalLabel(event, 'ApplyExperimentalEffect')
  if (!blueprint && !effect) return null
  const grade = journalInteger(event, 'Level')
  return commanderLogEntry(event, {
    category: 'engineering',
    kind: 'engineering.blueprint_applied',
    title: effect ? 'Experimental effect applied' : 'Engineering blueprint applied',
    detail: detail(effect ?? blueprint, grade === null ? null : `Grade ${grade}`, journalText(event, 'Engineer')),
    creditDelta: null,
    tone: 'positive'
  })
}
