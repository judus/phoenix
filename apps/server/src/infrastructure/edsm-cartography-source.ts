import {
  CartographicSystemSchema,
  type CartographicBody,
  type CartographicStation,
  type CartographicSystem
} from '@phoenix/contracts'
import type { CartographySource } from '../domain/cartography.js'

const DEFAULT_BASE_URL = 'https://www.edsm.net/'
const DEFAULT_TIMEOUT_MS = 10_000

export interface EdsmCartographySourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  now?: () => Date
  timeoutMs?: number
}

export class EdsmCartographySource implements CartographySource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly now: () => Date
  private readonly timeoutMs: number

  public constructor (options: EdsmCartographySourceOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.now = options.now ?? (() => new Date())
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async fetchSystem (systemName: string): Promise<CartographicSystem> {
    const name = systemName.trim()
    if (!name) throw new Error('A system name is required.')

    const [systemRaw, bodiesRaw, stationsRaw] = await Promise.all([
      this.get('api-v1/system', { systemName: name, showCoordinates: '1', showInformation: '1', showPermit: '1', showPrimaryStar: '1' }),
      this.get('api-system-v1/bodies', { systemName: name }),
      this.get('api-system-v1/stations', { systemName: name })
    ])
    const system = record(systemRaw)
    const bodiesResponse = record(bodiesRaw)
    const stationsResponse = record(stationsRaw)
    const resolvedName = stringValue(system.name) ?? stringValue(bodiesResponse.name) ?? stringValue(stationsResponse.name)
    if (!resolvedName) throw new Error(`EDSM has no cartography record for "${name}".`)
    const information = record(system.information)

    return CartographicSystemSchema.parse({
      schemaVersion: 1,
      name: resolvedName,
      address: integerValue(system.id64) ?? integerValue(bodiesResponse.id64) ?? integerValue(stationsResponse.id64),
      position: coordinates(system.coords),
      permitRequired: booleanValue(system.requirePermit),
      permitName: stringValue(system.permitName),
      information: {
        allegiance: stringValue(information.allegiance),
        government: stringValue(information.government),
        security: stringValue(information.security),
        state: stringValue(information.factionState),
        primaryEconomy: stringValue(information.economy),
        secondaryEconomy: stringValue(information.secondEconomy),
        population: integerValue(information.population),
        controllingFaction: stringValue(information.faction)
      },
      primaryStar: nullableRecord(system.primaryStar),
      bodies: arrayValue(bodiesResponse.bodies).map(mapBody).filter(isPresent),
      stations: arrayValue(stationsResponse.stations).map(mapStation).filter(isPresent),
      scanProgress: {
        knownBodies: arrayValue(bodiesResponse.bodies).length,
        reportedBodies: null,
        percent: null
      },
      localSystem: null,
      source: { provider: 'edsm', fetchedAt: this.now().toISOString() },
      raw: { system, bodies: bodiesResponse, stations: stationsResponse }
    })
  }

  private async get (path: string, parameters: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.baseUrl)
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value)
    const response = await this.fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`EDSM ${path} request failed with HTTP ${response.status}.`)
    return await response.json()
  }
}

function mapBody (candidate: unknown): CartographicBody | null {
  const raw = nullableRecord(candidate)
  const name = raw ? stringValue(raw.name) : null
  if (!raw || !name) return null
  return {
    id: integerValue(raw.id),
    id64: integerValue(raw.id64),
    bodyId: integerValue(raw.bodyId),
    name,
    type: stringValue(raw.type),
    subType: stringValue(raw.subType),
    distanceToArrival: nonnegativeNumber(raw.distanceToArrival),
    parents: arrayValue(raw.parents).map(nullableRecord).filter(isPresent),
    local: null,
    raw
  }
}

function mapStation (candidate: unknown): CartographicStation | null {
  const raw = nullableRecord(candidate)
  const name = raw ? stringValue(raw.name) : null
  if (!raw || !name) return null
  const faction = nullableRecord(raw.controllingFaction)
  return {
    id: integerValue(raw.id),
    marketId: integerValue(raw.marketId),
    name,
    type: stringValue(raw.type),
    distanceToArrival: nonnegativeNumber(raw.distanceToArrival),
    allegiance: stringValue(raw.allegiance),
    government: stringValue(raw.government),
    economy: stringValue(raw.economy),
    secondEconomy: stringValue(raw.secondEconomy),
    controllingFaction: faction ? stringValue(faction.name) : null,
    services: arrayValue(raw.otherServices).filter((value): value is string => stringValue(value) !== null),
    facilities: {
      market: raw.haveMarket === true,
      shipyard: raw.haveShipyard === true,
      outfitting: raw.haveOutfitting === true
    },
    raw
  }
}

function record (candidate: unknown): Record<string, unknown> {
  return nullableRecord(candidate) ?? {}
}

function nullableRecord (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function arrayValue (candidate: unknown): unknown[] {
  return Array.isArray(candidate) ? candidate : []
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function integerValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
}

function booleanValue (candidate: unknown): boolean | null {
  return typeof candidate === 'boolean' ? candidate : null
}

function coordinates (candidate: unknown): [number, number, number] | null {
  const value = nullableRecord(candidate)
  return value && [value.x, value.y, value.z].every(item => typeof item === 'number' && Number.isFinite(item))
    ? [value.x as number, value.y as number, value.z as number]
    : null
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
