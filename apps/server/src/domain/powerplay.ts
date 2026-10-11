import type { PowerplayEntry, PowerplayResponse, PowerplayTarget } from '@phoenix/contracts'

export interface PowerplayRepository {
  putEntry(entry: PowerplayEntry): void
  projectionEntries(): PowerplayEntry[]
  recentEntries(limit: number): PowerplayEntry[]
  countEntries(): number
  getTarget(): PowerplayTarget | null
  setTarget(target: PowerplayTarget | null): void
}

export interface PowerplayReader {
  getPowerplay(): PowerplayResponse
  setTarget(target: PowerplayTarget | null): PowerplayResponse
}
