import { createHash } from 'node:crypto'
import { PowerplayEntrySchema, PowerplayResponseSchema, type PowerplayEntry, type PowerplayResponse, type PowerplayTarget } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { PowerplayReader, PowerplayRepository } from '../domain/powerplay.js'

const kinds: Record<string, PowerplayEntry['kind']> = {
  Powerplay: 'snapshot', PowerplayJoin: 'join', PowerplayLeave: 'leave', PowerplayDefect: 'defect',
  PowerplayMerits: 'merits', PowerplayRank: 'rank', PowerplayCollect: 'collect', PowerplayDeliver: 'deliver'
}

export class PowerplayDataService implements PowerplayReader {
  public constructor(private readonly repository: PowerplayRepository) {}

  public ingest(event: EliteJournalEvent): void {
    const kind = kinds[event.event]
    if (!kind) return
    const timestamp = new Date(event.timestamp)
    if (!Number.isFinite(timestamp.getTime())) return
    const result = PowerplayEntrySchema.safeParse({
      id: 'pending', timestamp: timestamp.toISOString(), kind,
      power: kind === 'defect' ? event.ToPower : event.Power,
      fromPower: kind === 'defect' ? event.FromPower : null,
      rank: kind === 'snapshot' || kind === 'rank' ? event.Rank : null,
      merits: kind === 'snapshot' ? event.Merits : kind === 'merits' ? event.TotalMerits : null,
      gained: kind === 'merits' ? event.MeritsGained : null,
      timePledged: kind === 'snapshot' ? event.TimePledged : null,
      item: kind === 'collect' || kind === 'deliver' ? event.Type_Localised ?? event.Type : null,
      count: kind === 'collect' || kind === 'deliver' ? event.Count : null
    })
    if (!result.success) return
    const entry = result.data
    entry.id = createHash('sha256').update(JSON.stringify(entry)).digest('hex')
    this.repository.putEntry(entry)
  }

  public getPowerplay(): PowerplayResponse {
    const pledge: PowerplayResponse['pledge'] = {
      power: null, status: 'unknown', rank: null, merits: null,
      pledgedAt: null, updatedAt: null, rankAt: null, meritsAt: null
    }
    for (const entry of this.repository.projectionEntries()) {
      if (entry.kind === 'leave') {
        Object.assign(pledge, { power: null, status: 'left', rank: null, merits: null,
          pledgedAt: null, updatedAt: entry.timestamp, rankAt: null, meritsAt: null })
        continue
      }
      if (entry.kind === 'join' || entry.kind === 'defect' || entry.kind === 'snapshot') {
        Object.assign(pledge, { power: entry.power, status: 'pledged', rank: entry.rank, merits: entry.merits,
          pledgedAt: entry.kind === 'snapshot'
            ? new Date(Date.parse(entry.timestamp) - entry.timePledged! * 1000).toISOString() : entry.timestamp,
          updatedAt: entry.timestamp, rankAt: entry.rank === null ? null : entry.timestamp,
          meritsAt: entry.merits === null ? null : entry.timestamp })
        continue
      }
      // A merits/rank observation can establish a partial record when startup history is missing.
      // Deliveries to another power do not establish or change personal membership.
      if (pledge.status === 'unknown' && (entry.kind === 'merits' || entry.kind === 'rank')) {
        pledge.power = entry.power
        pledge.status = 'pledged'
      }
      if (pledge.power !== entry.power || pledge.status !== 'pledged') continue
      if (entry.kind === 'merits') { pledge.merits = entry.merits; pledge.meritsAt = entry.timestamp }
      if (entry.kind === 'rank') { pledge.rank = entry.rank; pledge.rankAt = entry.timestamp }
      if (entry.kind === 'merits' || entry.kind === 'rank') pledge.updatedAt = entry.timestamp
    }
    const target = this.repository.getTarget()
    let targetProgress: PowerplayResponse['targetProgress'] = null
    if (target) {
      const samePower = pledge.status === 'pledged' && pledge.power === target.power
      const known = samePower && (target.rank === null || pledge.rank !== null) && (target.merits === null || pledge.merits !== null)
      const met = known && (target.rank === null || pledge.rank! >= target.rank) && (target.merits === null || pledge.merits! >= target.merits)
      targetProgress = {
        status: pledge.status === 'unknown' ? 'unknown' : pledge.status === 'left' ? 'unpledged' : !samePower ? 'different-power' : !known ? 'unknown' : met ? 'requirements-met' : 'tracking',
        remainingMerits: samePower && target.merits !== null && pledge.merits !== null ? Math.max(0, target.merits - pledge.merits) : null
      }
    }
    return PowerplayResponseSchema.parse({ pledge, target, targetProgress,
      entries: this.repository.recentEntries(100), retained: this.repository.countEntries() })
  }

  public setTarget(target: PowerplayTarget | null): PowerplayResponse {
    this.repository.setTarget(target)
    return this.getPowerplay()
  }
}
