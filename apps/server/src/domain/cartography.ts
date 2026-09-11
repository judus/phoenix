import type { CartographicSystem } from '@phoenix/contracts'

export interface CartographyRepository {
  findRecord(systemName: string): CartographyRecord | null
  listObservedRecords(): CartographyRecord[]
  putExternalSystem(system: CartographicSystem): void
  putLocalObservation(observation: LocalSystemCartographyObservation): void
}

export interface ExternalCartographySource {
  fetchSystem(systemName: string): Promise<CartographicSystem>
}

export interface LocalBodyCartographyObservation {
  bodyId: number | null
  bodyName: string
  bodySignals: Record<string, unknown> | null
  footfallCompleted: boolean
  previouslyDiscovered: boolean | null
  previouslyFootfalled: boolean | null
  previouslyMapped: boolean | null
  observedAt: string
  organicSamples: LocalOrganicSampleObservation[]
  scan: Record<string, unknown> | null
  surfaceScanCompleted: boolean
  surfaceSignals: Record<string, unknown> | null
}

export function hasCartographicBodyEvidence (observation: LocalBodyCartographyObservation): boolean {
  return observation.scan !== null ||
    observation.bodySignals !== null ||
    observation.surfaceSignals !== null ||
    observation.surfaceScanCompleted ||
    observation.footfallCompleted ||
    observation.organicSamples.length > 0
}

export interface LocalOrganicSampleObservation {
  completed: boolean
  genus: string
  genusId: string | null
  lastUpdated: string
  progress: number
  scanTypes: string[]
  species: string
  speciesId: string | null
  variant: string
  variantId: string | null
}

export interface LocalSystemCartographyObservation {
  allBodiesFound?: boolean
  bodies: LocalBodyCartographyObservation[]
  reportedBodyCount: number | null
  systemAddress: number | null
  systemName: string
  updatedAt: string
}

export interface CartographyRecord {
  external: CartographicSystem | null
  local: LocalSystemCartographyObservation | null
  systemName: string
}

export interface CartographyLookupOptions {
  forceRefresh?: boolean
}

export interface CartographyLookupResult {
  cache: 'fresh' | 'refreshed' | 'stale' | 'local'
  system: CartographicSystem
}

export interface SystemCartography {
  getSystem(systemName: string, options?: CartographyLookupOptions): Promise<CartographyLookupResult>
}
