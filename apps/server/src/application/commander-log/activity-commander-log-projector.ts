import type { EliteJournalEvent } from '@phoenix/elite'
import { commanderLogEntry, detail, journalInteger, journalLabel, journalText, recordInteger } from './commander-log-event.js'

export function projectActivityCommanderLogEntry (event: EliteJournalEvent, location: string | null, body: string | null) {
  if (event.event === 'MaterialTrade') {
    const paid = material(event.Paid)
    const received = material(event.Received)
    if (!paid || !received) return null
    return commanderLogEntry(event, {
      category: 'engineering', kind: 'engineering.materials_traded', title: 'Materials traded',
      detail: detail(`${paid} → ${received}`, location),
      creditDelta: null, tone: 'neutral'
    })
  }
  if (event.event === 'SearchAndRescue') {
    const count = journalInteger(event, 'Count')
    const name = journalLabel(event, 'Name')
    if (!name || count === null || count === 0) return null
    return commanderLogEntry(event, {
      category: 'finance', kind: 'finance.salvage_delivered', title: 'Salvage delivered',
      detail: detail(`${count} × ${name}`, location),
      creditDelta: journalInteger(event, 'Reward'), tone: 'positive'
    })
  }
  if (event.event === 'ScanOrganic' && event.ScanType === 'Analyse') {
    const species = journalLabel(event, 'Species')
    if (!species) return null
    return commanderLogEntry(event, {
      category: 'exploration', kind: 'exploration.biological_analysis_completed',
      title: 'Biological analysis completed',
      detail: detail(journalLabel(event, 'Variant') ?? species, body),
      creditDelta: null, tone: 'positive'
    })
  }
  return null
}

function material (value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const name = journalText(record as EliteJournalEvent, 'Material_Localised') ?? journalText(record as EliteJournalEvent, 'Material')
  const count = recordInteger(record, 'Quantity')
  return name && count !== null && count > 0 ? `${count} × ${name}` : null
}
