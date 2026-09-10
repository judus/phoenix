export type ExplorationLandableFilter = 'any' | 'yes' | 'no'

export interface ExplorationTargetSearchRequest {
  atmospheres: string[]
  bodySubtypes: string[]
  landable: ExplorationLandableFilter
  lastReportedBefore: string | null
  maxDistanceLy: number
  maxGravityG: number | null
  maxTemperatureK: number | null
  minGravityG: number | null
  minBiologicalSignals: number
  minGeologicalSignals: number
  minTemperatureK: number | null
  referencePosition: [number, number, number]
  volcanismTypes: string[]
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
