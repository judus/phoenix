import type { FleetResponse, FleetShip, ModuleDefinition, StoredModule } from '@phoenix/contracts'

export interface FleetRepository {
  getFleetProjectionTimestamp(key: string): string | null
  getFleetShip(id: number): FleetShip | null
  listFleetShips(): FleetShip[]
  listStoredModules(): StoredModule[]
  putFleetProjectionTimestamp(key: string, timestamp: string): void
  putFleetShip(ship: FleetShip): void
  replaceStoredModules(modules: StoredModule[]): void
}

export interface FleetDataReader {
  getFleet(): FleetResponse
}

export interface FleetCatalogueResolver {
  resolveBlueprintDisplayName(symbol: string): string | null
  resolveModule(identifier: string): ModuleDefinition
  resolveShipDisplayName(identifier: string): string | null
}

export interface MarketStationResolver {
  resolve(systemName: string, marketId: number): string | null
}
