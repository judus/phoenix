export type ExplorationLandableFilter = 'any' | 'yes' | 'no'

export interface ExplorationTargetSearchRequest {
  atmosphere: string | null
  bodyType: string | null
  landable: ExplorationLandableFilter
  maxDistanceLy: number
  maxGravityG: number | null
  maxTemperatureK: number | null
  minGravityG: number | null
  minTemperatureK: number | null
  referencePosition: [number, number, number]
  volcanism: string | null
}

export interface ExplorationTargetSearchResult {
  atmosphere: string | null
  biologicalSignals: number
  bodyId: number | null
  bodyName: string
  bodyType: string | null
  distanceLy: number
  distanceToArrivalLs: number | null
  geologicalSignals: number
  gravityG: number | null
  landable: boolean | null
  providerUpdatedAt: string | null
  signalsUpdatedAt: string | null
  subtype: string | null
  surfaceTemperatureK: number | null
  systemAddress: number | null
  systemName: string
  volcanism: string | null
}

export interface ExplorationTargetSearchSource {
  findTargets(request: ExplorationTargetSearchRequest): Promise<ExplorationTargetSearchResult[]>
}
