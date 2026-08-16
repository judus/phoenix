import type { FleetResponse, FleetShip, StoredModule } from '@phoenix/contracts'

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
