import type { CommanderLogEntry } from '@phoenix/contracts'
import { formatPhoenixDateTime } from '../../components/phoenix-date-time.js'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'

export interface CommanderLogItemViewModel {
  category: string
  dateTime: string
  detail: string | null
  id: string
  timestamp: string
  title: string
  tone: CommanderLogEntry['tone']
  value: string | null
}

export function createCommanderLogViewModel (
  entries: readonly CommanderLogEntry[],
  locale = 'en-CH'
): CommanderLogItemViewModel[] {
  return entries.slice(0, 10).reverse().map(entry => ({
    category: categoryLabel(entry.category),
    dateTime: formatPhoenixDateTime(entry.timestamp),
    detail: entry.detail,
    id: entry.id,
    timestamp: entry.timestamp,
    title: entry.title,
    tone: entry.tone,
    value: formatCreditDelta(entry.creditDelta, locale)
  }))
}

function categoryLabel (category: CommanderLogEntry['category']): string {
  return {
    mission: 'Mission',
    trade: 'Trade',
    finance: 'Finance',
    fleet: 'Fleet',
    career: 'Career',
    engineering: 'Engineering'
  }[category]
}

function formatCreditDelta (value: number | null, locale: string): string | null {
  if (value === null) return null
  const formatted = formatPhoenixCredits(Math.abs(value), locale)
  return `${value >= 0 ? '+' : '−'}${formatted}`
}
