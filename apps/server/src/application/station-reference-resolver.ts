import { ToolUsageError, type JsonObject } from '@jdu/llm-client'
import type { CartographicStation } from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import { optionalIntegerArgument, optionalStringArgument } from './mcp-tools/tool-support.js'
import { stationNameSuggestions } from './station-name-suggestions.js'

export interface ResolvedStation {
  station: CartographicStation
  systemName: string
  cache: 'fresh' | 'refreshed' | 'stale' | 'local'
}

/** Resolves one exact station reference; suggestions never select a station implicitly. */
export class StationReferenceResolver {
  public constructor (
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public async resolve (arguments_: JsonObject, toolName: string): Promise<ResolvedStation> {
    const state = this.runtimeState.getCurrent()
    const systemName = optionalStringArgument(arguments_, 'systemName') ?? state.system.name
    if (!systemName) throw new ToolUsageError(toolName, 'Current system is unavailable.', 'Provide systemName explicitly.', { code: 'station_system_required' })
    const isCurrentSystem = state.system.name !== null && sameName(state.system.name, systemName)
    const requestedName = optionalStringArgument(arguments_, 'stationName')
      ?? (isCurrentSystem && state.location.place?.kind === 'station' ? state.location.place.name : undefined)
    const requestedMarketId = optionalIntegerArgument(arguments_, 'marketId')
    if (!requestedName && requestedMarketId === undefined) {
      throw new ToolUsageError(toolName, 'No station is selected.', 'Provide stationName or marketId, and systemName if the station is elsewhere.', { code: 'station_reference_required' })
    }
    const cartography = await this.cartography.getSystem(systemName)
    const station = cartography.system.stations.find(candidate => (
      requestedMarketId !== undefined
        ? candidate.marketId === requestedMarketId
        : requestedName !== undefined && sameName(candidate.name, requestedName)
    )) ?? localStation(state, systemName, requestedName, requestedMarketId)
    if (!station) {
      const suggestions = requestedMarketId === undefined && requestedName
        ? stationNameSuggestions(requestedName, cartography.system.stations.map(candidate => candidate.name))
        : []
      const correction = suggestions.length > 0
        ? `Possible station-name matches in the selected system (up to five): ${suggestions.map(name => JSON.stringify(name)).join(', ')}. These are suggestions, not a selected station. If one clearly matches the intended station, retry with its exact stationName and this systemName; otherwise ask the user to choose. Omit marketId when retrying by name.`
        : 'Verify the system and station spelling or marketId. Use stations.find_stations_by_name to locate the station if available, or ask the user for the full station name and system. Do not repeat the unchanged call.'
      throw new ToolUsageError(toolName,
        requestedMarketId === undefined ? 'No exact station-name match was found in the selected system.' : 'No station with that marketId was found in the selected system.',
        correction, { code: 'station_not_found' })
    }
    return { cache: cartography.cache, station, systemName: cartography.system.name }
  }
}

function localStation (
  state: ReturnType<RuntimeStateReader['getCurrent']>,
  systemName: string,
  requestedName?: string,
  requestedMarketId?: number
): CartographicStation | null {
  const place = state.location.place
  if (!state.system.name || !sameName(state.system.name, systemName)) return null
  if (place?.kind !== 'station') return null
  if (requestedName && !sameName(place.name, requestedName)) return null
  if (requestedMarketId !== undefined && place.marketId !== requestedMarketId) return null
  const serviceNames = place.services.map(service => service.toLocaleLowerCase())
  return {
    allegiance: place.faction?.allegiance ?? null,
    controllingFaction: place.faction?.name ?? null,
    distanceToArrival: null,
    economy: place.primaryEconomy?.label ?? place.primaryEconomy?.id ?? null,
    facilities: {
      market: serviceNames.some(service => service.includes('commodit') || service === 'market'),
      outfitting: serviceNames.includes('outfitting'),
      shipyard: serviceNames.includes('shipyard')
    },
    government: place.government?.label ?? place.government?.id ?? null,
    id: null,
    marketId: place.marketId,
    name: place.name,
    raw: {},
    secondEconomy: place.economies[1]?.economy.label ?? place.economies[1]?.economy.id ?? null,
    services: place.services,
    type: place.type
  }
}

function sameName (left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}
