import { createHash } from 'node:crypto'
import { ColonisationClaimSchema, ColonisationContributionSchema, ColonisationDepotSchema, type RuntimeState } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { ColonisationReader, ColonisationRepository } from '../domain/colonisation.js'

export class ColonisationDataService implements ColonisationReader {
  public constructor(private readonly repository: ColonisationRepository) {}

  public ingest(event: EliteJournalEvent, state: RuntimeState): void {
    if (!event.event.startsWith('Colonisation')) return
    const date = new Date(event.timestamp)
    if (!Number.isFinite(date.getTime())) return
    const timestamp = date.toISOString()
    if (event.event === 'ColonisationSystemClaim' || event.event === 'ColonisationSystemClaimRelease') {
      const result = ColonisationClaimSchema.safeParse({ system: event.StarSystem, systemAddress: event.SystemAddress,
        updatedAt: timestamp, status: event.event === 'ColonisationSystemClaim' ? 'claimed' : 'released' })
      if (result.success) this.repository.putClaim(result.data)
      return
    }
    // Only associate a depot with the currently observed station when MarketID agrees.
    // Historical ingestion supplies its own historical runtime, never today's location.
    const place = state.location.place
    const matches = place?.kind === 'station' && place.marketId === event.MarketID
    const location = { system: matches ? state.system.name : null, station: matches ? place.name : null }
    if (event.event === 'ColonisationConstructionDepot') {
      const resources = Array.isArray(event.ResourcesRequired) ? event.ResourcesRequired.map(item => {
        if (!item || typeof item !== 'object') return item
        const value = item as Record<string, unknown>
        return { id: value.Name, name: value.Name_Localised ?? value.Name, required: value.RequiredAmount,
          provided: value.ProvidedAmount, payment: value.Payment ?? null }
      }) : event.ResourcesRequired
      const result = ColonisationDepotSchema.safeParse({ marketId: event.MarketID, ...location,
        updatedAt: timestamp, progress: event.ConstructionProgress, complete: event.ConstructionComplete,
        failed: event.ConstructionFailed, resources })
      if (result.success) this.repository.putDepot(result.data)
    }
    if (event.event === 'ColonisationContribution') {
      const items = Array.isArray(event.Contributions) ? event.Contributions.map(item => {
        if (!item || typeof item !== 'object') return item
        const value = item as Record<string, unknown>
        return { id: value.Name, name: value.Name_Localised ?? value.Name, amount: value.Amount }
      }) : event.Contributions
      const id = createHash('sha256').update(JSON.stringify({ timestamp, marketId: event.MarketID, items })).digest('hex')
      const result = ColonisationContributionSchema.safeParse({ id, timestamp, marketId: event.MarketID, ...location, items })
      if (result.success) this.repository.putContribution(result.data)
    }
  }

  public getColonisation() { return this.repository.read() }
}
