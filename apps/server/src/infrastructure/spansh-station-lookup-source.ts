import type {
  StationLocationType,
  StationLookupRequest,
  StationLookupResult,
  StationLookupSource
} from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import { spanshIsoString, spanshNames, spanshStationRecord, spanshString } from './spansh-station-record.js'

const ORBITAL_TYPES = [
  'Asteroid Base',
  'Coriolis Starport',
  'Dodec Starport',
  'Dockable Planet Station',
  'Mega Ship',
  'Ocellus Starport',
  'Orbis Starport',
  'Outpost',
  'Space Construction Depot'
]
const SURFACE_TYPES = [
  'Planetary Construction Depot',
  'Planetary Outpost',
  'Planetary Port',
  'Settlement'
]

export class SpanshStationLookupSource implements StationLookupSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findStations (request: StationLookupRequest): Promise<StationLookupResult[]> {
    const names = await this.spansh.findFieldValues('stations', 'name', request.name)
    if (names.length === 0) return []
    const filters: Record<string, unknown> = {
      distance: { max: String(request.maxDistanceLy), min: 0 },
      name: { value: names }
    }
    const stationTypes = providerTypes(request.stationType)
    if (stationTypes) filters.type = { value: stationTypes }
    if (request.minimumPadSize === 3) filters.has_large_pad = { value: true }

    const candidates = await this.spansh.search('stations', {
      filters,
      referencePosition: request.referencePosition
    })
    return candidates.flatMap(candidate => mapStation(candidate, request))
  }
}

function mapStation (candidate: unknown, request: StationLookupRequest): StationLookupResult[] {
  const station = spanshStationRecord(candidate)
  if (!station) return []
  const { raw, ...location } = station
  if (!station.stationName.toLocaleLowerCase().includes(request.name.toLocaleLowerCase())) return []
  if (station.distanceLy > request.maxDistanceLy) return []
  if (request.minimumPadSize !== null && (station.maxLandingPadSize === null || station.maxLandingPadSize < request.minimumPadSize)) return []
  if (!matchesStationType(raw, request.stationType)) return []
  return [{
    ...location,
    allegiance: spanshString(raw.allegiance),
    controllingFaction: spanshString(raw.controlling_minor_faction),
    government: spanshString(raw.government),
    primaryEconomy: spanshString(raw.primary_economy),
    secondaryEconomy: spanshString(raw.secondary_economy),
    services: spanshNames(raw.services),
    updatedAt: spanshIsoString(raw.updated_at)
  }]
}

function providerTypes (stationType: StationLocationType): string[] | null {
  if (stationType === 'carrier') return ['Drake-Class Carrier']
  if (stationType === 'orbital') return ORBITAL_TYPES
  if (stationType === 'surface') return SURFACE_TYPES
  return null
}

function matchesStationType (raw: Record<string, unknown>, stationType: StationLocationType): boolean {
  if (stationType === 'any') return true
  const type = spanshString(raw.type)
  if (stationType === 'carrier') return type === 'Drake-Class Carrier'
  if (stationType === 'surface') return raw.is_planetary === true || (type !== null && SURFACE_TYPES.includes(type))
  return raw.is_planetary === false && type !== 'Drake-Class Carrier'
}
