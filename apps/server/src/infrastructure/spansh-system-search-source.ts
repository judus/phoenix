import type {
  SystemSearchRequest,
  SystemSearchResult,
  SystemSearchSource
} from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'

export class SpanshSystemSearchSource implements SystemSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findSystems (request: SystemSearchRequest): Promise<SystemSearchResult[]> {
    const candidates = await this.spansh.search('systems', {
      filters: providerFilters(request),
      referencePosition: request.referencePosition
    })
    return candidates.map(mapSystem).filter(isPresent)
  }
}

function providerFilters (request: SystemSearchRequest): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    distance: { max: String(request.maxDistanceLy), min: '0' }
  }
  if (request.allegiance) filters.allegiance = { value: [request.allegiance] }
  if (request.economy) filters.primary_economy = { value: [request.economy] }
  if (request.government) filters.government = { value: [request.government] }
  if (request.security) filters.security = { value: [request.security] }

  const population: Record<string, string> = {}
  if (request.population === 'inhabited') population.min = '1'
  if (request.population === 'uninhabited') population.max = '0'
  if (request.minPopulation !== null) population.min = String(request.minPopulation)
  if (request.maxPopulation !== null) population.max = String(request.maxPopulation)
  if (Object.keys(population).length > 0) filters.population = population
  return filters
}

function mapSystem (candidate: unknown): SystemSearchResult | null {
  const raw = record(candidate)
  const systemName = stringValue(raw?.name)
  const distanceLy = nonnegativeNumber(raw?.distance)
  const x = finiteNumber(raw?.x)
  const y = finiteNumber(raw?.y)
  const z = finiteNumber(raw?.z)
  const population = nonnegativeNumber(raw?.population)
  if (!raw || !systemName || distanceLy === null || x === null || y === null || z === null || population === null) return null
  const mainStar = Array.isArray(raw.bodies)
    ? raw.bodies.map(record).find(body => body?.type === 'Star' && body.is_main_star === true)
    : undefined
  return {
    allegiance: stringValue(raw.allegiance),
    controllingFaction: stringValue(raw.controlling_minor_faction),
    distanceLy,
    economy: stringValue(raw.primary_economy),
    government: stringValue(raw.government),
    inhabited: population > 0,
    permitRequired: booleanValue(raw.needs_permit),
    population,
    position: [x, y, z],
    primaryStarClass: stringValue(mainStar?.subtype),
    secondaryEconomy: stringValue(raw.secondary_economy),
    security: stringValue(raw.security),
    systemAddress: integerValue(raw.id64),
    systemName,
    updatedAt: isoString(raw.updated_at)
  }
}

function record (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function finiteNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  const value = finiteNumber(candidate)
  return value !== null && value >= 0 ? value : null
}

function integerValue (candidate: unknown): number | null {
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate
  if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
    const value = Number(candidate)
    return Number.isSafeInteger(value) ? value : null
  }
  return null
}

function booleanValue (candidate: unknown): boolean | null {
  return typeof candidate === 'boolean' ? candidate : null
}

function isoString (candidate: unknown): string | null {
  const value = stringValue(candidate)
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
