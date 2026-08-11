import type { CartographicSystem } from '@phoenix/contracts'

export interface CartographyCache {
  getSystem(systemName: string): CartographicSystem | null
  putSystem(system: CartographicSystem): void
}

export interface CartographySource {
  fetchSystem(systemName: string): Promise<CartographicSystem>
}

export interface LocalBodyCartographyObservation {
  bodyId: number | null
  bodyName: string
  bodySignals: Record<string, unknown> | null
  discovered: boolean | null
  footfalled: boolean | null
  mapped: boolean | null
  observedAt: string
  organicSamples: LocalOrganicSampleObservation[]
  scan: Record<string, unknown> | null
  surfaceScanCompleted: boolean
  surfaceSignals: Record<string, unknown> | null
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
  bodies: LocalBodyCartographyObservation[]
  reportedBodyCount: number | null
  systemAddress: number | null
  systemName: string
  updatedAt: string
}

export interface CartographyObservationStore {
  getObservation(systemName: string): LocalSystemCartographyObservation | null
  putObservation(observation: LocalSystemCartographyObservation): void
}

export interface CartographyLookupOptions {
  forceRefresh?: boolean
}

export interface CartographyLookupResult {
  cache: 'fresh' | 'refreshed' | 'stale'
  system: CartographicSystem
}

export interface SystemCartography {
  getSystem(systemName: string, options?: CartographyLookupOptions): Promise<CartographyLookupResult>
}
