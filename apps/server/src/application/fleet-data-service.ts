import {
  FleetResponseSchema,
  FleetShipSchema,
  StoredModuleSchema,
  type FleetResponse,
  type FleetShip,
  type StoredModule
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { FleetDataReader, FleetRepository } from '../domain/fleet.js'

export class FleetDataService implements FleetDataReader {
  public constructor (
    private readonly repository: FleetRepository,
    private readonly resolveShipDisplayName: (identifier: string) => string | null = () => null
  ) {}

  public ingest (event: EliteJournalEvent): void {
    switch (event.event) {
      case 'Loadout': this.ingestLoadout(event); break
      case 'StoredShips': this.ingestStoredShips(event); break
      case 'ShipyardNew': this.ingestShipyardNew(event); break
      case 'ShipyardSell': this.ingestShipyardSell(event); break
      case 'ShipyardSwap': this.ingestShipyardSwap(event); break
      case 'ShipyardTransfer': this.ingestShipyardTransfer(event); break
      case 'StoredModules': this.ingestStoredModules(event); break
      case 'ModuleStore':
      case 'ModuleRetrieve': this.recordModuleMutation(event.timestamp); break
      case 'Location':
      case 'Docked':
      case 'FSDJump':
      case 'CarrierJump':
      case 'Undocked': this.ingestActiveLocation(event); break
    }
  }

  public getFleet (): FleetResponse {
    const ships = this.repository.listFleetShips()
      .filter(ship => ship.state !== 'sold')
      .map(ship => FleetShipSchema.parse({
        ...ship,
        displayName: ship.displayName ?? (ship.typeId === null ? null : this.resolveShipDisplayName(ship.typeId))
      }))
      .sort(compareShips)
    const snapshotAt = this.repository.getFleetProjectionTimestamp('stored-modules-snapshot')
    const latestMutationAt = this.repository.getFleetProjectionTimestamp('stored-modules-mutation')
    const details = snapshotAt === null
      ? 'unknown'
      : latestMutationAt !== null && latestMutationAt > snapshotAt ? 'partial' : 'complete'
    const count = (state: FleetShip['state']) => ships.filter(ship => ship.state === state).length
    return FleetResponseSchema.parse({
      activeShipId: ships.find(ship => ship.state === 'active')?.id ?? null,
      carriers: { observed: false, items: [] },
      ships,
      storedModules: {
        details,
        items: this.repository.listStoredModules(),
        latestMutationAt,
        snapshotAt
      },
      summary: {
        active: count('active'),
        owned: ships.length,
        stored: count('stored-here') + count('stored-remote'),
        transferring: count('transfer'),
        unknown: count('unknown')
      }
    })
  }

  private ingestLoadout (event: EliteJournalEvent): void {
    const id = integer(event.ShipID)
    if (id === null) return
    for (const ship of this.repository.listFleetShips()) {
      if (ship.id !== id && ship.state === 'active' && event.timestamp >= ship.updatedAt) {
        this.repository.putFleetShip(FleetShipSchema.parse({ ...ship, state: 'unknown', updatedAt: event.timestamp }))
      }
    }
    const current = this.repository.getFleetShip(id) ?? emptyShip(id, event.timestamp)
    if (event.timestamp < current.updatedAt) return
    this.repository.putFleetShip(FleetShipSchema.parse({
      ...current,
      displayName: text(event.Ship_Localised) ?? current.displayName,
      identifier: text(event.ShipIdent) ?? current.identifier,
      name: nonBlank(event.ShipName) ?? current.name,
      state: 'active',
      transferPrice: null,
      transferSeconds: null,
      typeId: text(event.Ship) ?? current.typeId,
      updatedAt: event.timestamp,
      value: integer(event.HullValue) !== null && integer(event.ModulesValue) !== null
        ? integer(event.HullValue)! + integer(event.ModulesValue)!
        : current.value
    }))
  }

  private ingestStoredShips (event: EliteJournalEvent): void {
    const previous = this.repository.getFleetProjectionTimestamp('stored-ships-snapshot')
    if (previous !== null && event.timestamp < previous) return
    const observed = new Set<number>()
    const ingest = (candidate: unknown, state: 'stored-here' | 'stored-remote'): void => {
      if (!record(candidate)) return
      const id = integer(candidate.ShipID)
      if (id === null) return
      observed.add(id)
      const current = this.repository.getFleetShip(id) ?? emptyShip(id, event.timestamp)
      this.repository.putFleetShip(FleetShipSchema.parse({
        ...current,
        displayName: text(candidate.ShipType_Localised) ?? current.displayName,
        hot: boolean(candidate.Hot) ?? current.hot,
        marketId: integer(candidate.ShipMarketID) ?? integer(event.MarketID) ?? current.marketId,
        name: nonBlank(candidate.Name) ?? current.name,
        state,
        station: state === 'stored-here' ? text(event.StationName) : null,
        system: text(candidate.StarSystem) ?? text(event.StarSystem) ?? current.system,
        transferPrice: integer(candidate.TransferPrice),
        transferSeconds: integer(candidate.TransferTime),
        typeId: text(candidate.ShipType) ?? current.typeId,
        updatedAt: event.timestamp,
        value: integer(candidate.Value) ?? current.value
      }))
    }
    if (Array.isArray(event.ShipsHere)) for (const ship of event.ShipsHere) ingest(ship, 'stored-here')
    if (Array.isArray(event.ShipsRemote)) for (const ship of event.ShipsRemote) ingest(ship, 'stored-remote')
    for (const ship of this.repository.listFleetShips()) {
      if (!observed.has(ship.id) && (ship.state === 'stored-here' || ship.state === 'stored-remote') && event.timestamp >= ship.updatedAt) {
        this.repository.putFleetShip(FleetShipSchema.parse({ ...ship, state: 'unknown', updatedAt: event.timestamp }))
      }
    }
    this.repository.putFleetProjectionTimestamp('stored-ships-snapshot', event.timestamp)
  }

  private ingestShipyardNew (event: EliteJournalEvent): void {
    const id = integer(event.NewShipID)
    if (id === null) return
    this.markActive(id, event, text(event.ShipType), text(event.ShipType_Localised))
  }

  private ingestShipyardSell (event: EliteJournalEvent): void {
    const id = integer(event.SellShipID)
    if (id === null) return
    const current = this.repository.getFleetShip(id) ?? emptyShip(id, event.timestamp)
    if (event.timestamp < current.updatedAt) return
    this.repository.putFleetShip(FleetShipSchema.parse({
      ...current,
      displayName: text(event.ShipType_Localised) ?? current.displayName,
      marketId: integer(event.ShipMarketID) ?? current.marketId,
      state: 'sold',
      system: text(event.System) ?? current.system,
      typeId: text(event.ShipType) ?? current.typeId,
      updatedAt: event.timestamp,
      value: integer(event.ShipPrice) ?? current.value
    }))
  }

  private ingestShipyardSwap (event: EliteJournalEvent): void {
    const activeId = integer(event.ShipID)
    const storedId = integer(event.StoreShipID)
    if (storedId !== null) {
      const stored = this.repository.getFleetShip(storedId) ?? emptyShip(storedId, event.timestamp)
      if (event.timestamp >= stored.updatedAt) this.repository.putFleetShip(FleetShipSchema.parse({
        ...stored,
        marketId: integer(event.MarketID) ?? stored.marketId,
        state: 'stored-here',
        typeId: text(event.StoreOldShip) ?? stored.typeId,
        updatedAt: event.timestamp
      }))
    }
    if (activeId !== null) this.markActive(activeId, event, text(event.ShipType), text(event.ShipType_Localised))
  }

  private ingestShipyardTransfer (event: EliteJournalEvent): void {
    const id = integer(event.ShipID)
    if (id === null) return
    const current = this.repository.getFleetShip(id) ?? emptyShip(id, event.timestamp)
    if (event.timestamp < current.updatedAt) return
    this.repository.putFleetShip(FleetShipSchema.parse({
      ...current,
      displayName: text(event.ShipType_Localised) ?? current.displayName,
      marketId: integer(event.MarketID) ?? current.marketId,
      state: 'transfer',
      system: text(event.System) ?? current.system,
      transferPrice: integer(event.TransferPrice),
      transferSeconds: integer(event.TransferTime),
      typeId: text(event.ShipType) ?? current.typeId,
      updatedAt: event.timestamp
    }))
  }

  private ingestStoredModules (event: EliteJournalEvent): void {
    const previous = this.repository.getFleetProjectionTimestamp('stored-modules-snapshot')
    if (previous !== null && event.timestamp < previous) return
    const modules: StoredModule[] = []
    if (Array.isArray(event.Items)) for (const candidate of event.Items) {
      if (!record(candidate)) continue
      const storageSlot = integer(candidate.StorageSlot)
      const rawName = text(candidate.Name)
      const marketId = integer(candidate.MarketID)
      const system = text(candidate.StarSystem)
      if (storageSlot === null || rawName === null || marketId === null || system === null) continue
      modules.push(StoredModuleSchema.parse({
        buyPrice: integer(candidate.BuyPrice) ?? 0,
        displayName: text(candidate.Name_Localised),
        engineering: text(candidate.EngineerModifications) === null ? null : {
          blueprint: text(candidate.EngineerModifications)!,
          level: integer(candidate.Level),
          quality: number(candidate.Quality)
        },
        hot: boolean(candidate.Hot) ?? false,
        marketId,
        rawName,
        storageSlot,
        system,
        transferCost: integer(candidate.TransferCost) ?? 0,
        transferSeconds: integer(candidate.TransferTime) ?? 0,
        updatedAt: event.timestamp
      }))
    }
    this.repository.replaceStoredModules(modules)
    this.repository.putFleetProjectionTimestamp('stored-modules-snapshot', event.timestamp)
  }

  private markActive (id: number, event: EliteJournalEvent, typeId: string | null, displayName: string | null): void {
    for (const ship of this.repository.listFleetShips()) {
      if (ship.id !== id && ship.state === 'active' && event.timestamp >= ship.updatedAt) {
        this.repository.putFleetShip(FleetShipSchema.parse({ ...ship, state: 'unknown', updatedAt: event.timestamp }))
      }
    }
    const current = this.repository.getFleetShip(id) ?? emptyShip(id, event.timestamp)
    if (event.timestamp < current.updatedAt) return
    this.repository.putFleetShip(FleetShipSchema.parse({
      ...current,
      displayName: displayName ?? current.displayName,
      state: 'active',
      typeId: typeId ?? current.typeId,
      updatedAt: event.timestamp
    }))
  }

  private recordModuleMutation (timestamp: string): void {
    const previous = this.repository.getFleetProjectionTimestamp('stored-modules-mutation')
    if (previous === null || timestamp >= previous) this.repository.putFleetProjectionTimestamp('stored-modules-mutation', timestamp)
  }

  private ingestActiveLocation (event: EliteJournalEvent): void {
    const active = this.repository.listFleetShips().find(ship => ship.state === 'active')
    if (!active || event.timestamp < active.updatedAt) return
    const station = event.event === 'Undocked' || event.event === 'FSDJump'
      ? null
      : text(event.StationName) ?? active.station
    this.repository.putFleetShip(FleetShipSchema.parse({
      ...active,
      marketId: integer(event.MarketID) ?? active.marketId,
      station,
      system: text(event.StarSystem) ?? active.system,
      updatedAt: event.timestamp
    }))
  }
}

function emptyShip (id: number, updatedAt: string): FleetShip {
  return FleetShipSchema.parse({
    displayName: null, hot: null, id, identifier: null, marketId: null, name: null,
    state: 'unknown', station: null, system: null, transferPrice: null,
    transferSeconds: null, typeId: null, updatedAt, value: null
  })
}

function compareShips (left: FleetShip, right: FleetShip): number {
  const rank = (ship: FleetShip): number => ship.state === 'active' ? 0 : ship.state === 'transfer' ? 1 : ship.state.startsWith('stored') ? 2 : 3
  return rank(left) - rank(right) || (left.displayName ?? left.typeId ?? '').localeCompare(right.displayName ?? right.typeId ?? '') || left.id - right.id
}

function record (value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function text (value: unknown): string | null { return typeof value === 'string' ? value : null }
function nonBlank (value: unknown): string | null { const found = text(value)?.trim(); return found ? found : null }
function integer (value: unknown): number | null { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null }
function number (value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null }
function boolean (value: unknown): boolean | null { return typeof value === 'boolean' ? value : null }
