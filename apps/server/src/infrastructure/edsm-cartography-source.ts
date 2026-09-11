import {
  CartographicSystemSchema,
  type CartographicBody,
  type CartographicStation,
  type CartographicSystem
} from '@phoenix/contracts'
import type { ExternalCartographySource } from '../domain/cartography.js'

const ASTRONOMICAL_UNIT_KILOMETRES = 149_597_870.7
const SECONDS_PER_DAY = 86_400

const DEFAULT_BASE_URL = 'https://www.edsm.net/'
const DEFAULT_TIMEOUT_MS = 10_000

export interface EdsmCartographySourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  now?: () => Date
  timeoutMs?: number
}

export class EdsmCartographySource implements ExternalCartographySource {
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
    if (!resolvedName) throw new Error(`No cartography record for "${name}".`)
    const information = record(system.information)

    return CartographicSystemSchema.parse({
      schemaVersion: 5,
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
      provenance: { edsm: { fetchedAt: this.now().toISOString() }, journal: null },
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
    ...edsmBodyDetails(raw),
    local: null,
    raw
  }
}

export function edsmBodyDetails (raw: Record<string, unknown>): Pick<CartographicBody, 'landable' | 'gravityGs' | 'surfaceTemperatureKelvin' | 'radiusKilometres' | 'atmosphere' | 'ringed' | 'details' | 'firstDiscoveredBy' | 'firstFootfallBy' | 'firstMappedBy'> {
  const discovery = nullableRecord(raw.discovery)
  return {
    landable: booleanValue(raw.landable ?? raw.isLandable),
    gravityGs: nonnegativeNumber(raw.surfaceGravity ?? raw.gravity),
    surfaceTemperatureKelvin: nonnegativeNumber(raw.surfaceTemperature ?? raw.temperature),
    radiusKilometres: nonnegativeNumber(raw.radius),
    atmosphere: stringValue(raw.atmosphereType ?? raw.atmosphere),
    ringed: arrayValue(raw.rings).length > 0,
    details: {
      absoluteMagnitude: numberValue(raw.absoluteMagnitude),
      ageMillionYears: nonnegativeNumber(raw.age),
      atmosphereComposition: namedPercentages(raw.atmosphereComposition),
      isMainStar: booleanValue(raw.isMainStar),
      isScoopable: booleanValue(raw.isScoopable),
      luminosity: stringValue(raw.luminosity),
      massEarths: nonnegativeNumber(raw.earthMasses),
      materials: namedPercentages(raw.materials),
      orbit: {
        ascendingNodeDegrees: numberValue(raw.ascendingNode),
        axialTiltDegrees: scaledNumber(raw.axialTilt, 180 / Math.PI),
        eccentricity: nonnegativeNumber(raw.orbitalEccentricity),
        inclinationDegrees: numberValue(raw.orbitalInclination),
        meanAnomalyDegrees: numberValue(raw.meanAnomaly),
        orbitalPeriodSeconds: scaledNumber(raw.orbitalPeriod, SECONDS_PER_DAY),
        periapsisDegrees: numberValue(raw.argOfPeriapsis),
        rotationPeriodSeconds: scaledNumber(raw.rotationalPeriod, SECONDS_PER_DAY),
        semiMajorAxisKilometres: scaledNumber(raw.semiMajorAxis, ASTRONOMICAL_UNIT_KILOMETRES)
      },
      reserveLevel: stringValue(raw.reserveLevel),
      rings: edsmRings(raw.rings),
      scanType: null,
      solarMasses: nonnegativeNumber(raw.solarMasses),
      solarRadius: nonnegativeNumber(raw.solarRadius),
      solidComposition: edsmComposition(raw.solidComposition),
      spectralClass: stringValue(raw.spectralClass),
      starSubclass: null,
      surfacePressurePascals: scaledNonnegativeNumber(raw.surfacePressure, 101_325),
      terraformState: stringValue(raw.terraformingState),
      tidallyLocked: booleanValue(raw.rotationalPeriodTidallyLocked),
      volcanism: stringValue(raw.volcanismType)
    },
    firstDiscoveredBy: discovery ? stringValue(discovery.commander) : null,
    firstFootfallBy: null,
    firstMappedBy: null
  }
}

function edsmComposition (candidate: unknown): CartographicBody['details']['solidComposition'] {
  const value = nullableRecord(candidate)
  if (!value) return null
  const icePercent = boundedPercent(value.Ice ?? value.ice)
  const metalPercent = boundedPercent(value.Metal ?? value.metal)
  const rockPercent = boundedPercent(value.Rock ?? value.rock)
  return icePercent === null && metalPercent === null && rockPercent === null
    ? null
    : { icePercent, metalPercent, rockPercent }
}

function edsmRings (candidate: unknown): CartographicBody['details']['rings'] {
  return arrayValue(candidate).flatMap(item => {
    const value = nullableRecord(item)
    const name = value ? stringValue(value.name ?? value.Name) : null
    if (!value || !name) return []
    return [{
      innerRadiusKilometres: nonnegativeNumber(value.innerRadius ?? value.InnerRad),
      massMegatonnes: nonnegativeNumber(value.mass ?? value.MassMT),
      name,
      outerRadiusKilometres: nonnegativeNumber(value.outerRadius ?? value.OuterRad),
      type: stringValue(value.type ?? value.RingClass)
    }]
  })
}

function namedPercentages (candidate: unknown): Array<{ name: string, percent: number }> {
  if (Array.isArray(candidate)) {
    return candidate.flatMap(item => {
      const value = nullableRecord(item)
      const name = value ? stringValue(value.Name ?? value.name) : null
      const percent = value ? boundedPercent(value.Percent ?? value.percent) : null
      return name && percent !== null ? [{ name, percent }] : []
    })
  }
  const value = nullableRecord(candidate)
  if (!value) return []
  return Object.entries(value).flatMap(([name, percent]) => {
    const normalized = boundedPercent(percent)
    return normalized === null ? [] : [{ name, percent: normalized }]
  })
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

function numberValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

function scaledNumber (candidate: unknown, scale: number): number | null {
  const value = numberValue(candidate)
  return value === null ? null : value * scale
}

function scaledNonnegativeNumber (candidate: unknown, scale: number): number | null {
  const value = nonnegativeNumber(candidate)
  return value === null ? null : value * scale
}

function boundedPercent (candidate: unknown): number | null {
  const value = numberValue(candidate)
  return value !== null && value >= 0 && value <= 100 ? value : null
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
