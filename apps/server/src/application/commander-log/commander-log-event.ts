import { createHash } from 'node:crypto'
import {
  CommanderLogEntrySchema,
  type CommanderLogEntry
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'

type CommanderLogEntryContent = Omit<CommanderLogEntry, 'id' | 'schemaVersion' | 'sourceEvent' | 'timestamp'>

export function commanderLogEntry (
  event: EliteJournalEvent,
  content: CommanderLogEntryContent
): CommanderLogEntry {
  const fingerprint = createHash('sha256').update(JSON.stringify(event)).digest('hex')
  return CommanderLogEntrySchema.parse({
    ...content,
    schemaVersion: 1,
    id: `commander-log:${fingerprint}`,
    sourceEvent: event.event,
    timestamp: event.timestamp
  })
}

export function detail (...parts: Array<string | null>): string | null {
  const values = parts.filter((part): part is string => part !== null && part.length > 0)
  return values.length > 0 ? values.join(' · ') : null
}

export function journalInteger (event: EliteJournalEvent, key: string): number | null {
  const value = event[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

export function journalText (event: EliteJournalEvent, key: string): string | null {
  const value = event[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function journalLabel (event: EliteJournalEvent, key: string): string | null {
  return journalText(event, `${key}_Localised`) ?? journalText(event, key)
}

export function journalRecords (event: EliteJournalEvent, key: string): Record<string, unknown>[] {
  const value = event[key]
  return Array.isArray(value) ? value.filter(isRecord) : []
}

export function recordInteger (record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
