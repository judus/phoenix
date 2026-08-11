import type { CartographicBody, CartographicSystem, CurrentSystem } from '@phoenix/contracts'
import type {
  CartographyCache,
  CartographyObservationStore,
  CartographyLookupOptions,
  CartographyLookupResult,
  CartographySource,
  SystemCartography
} from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export class CachedSystemCartographyService implements SystemCartography {
  private readonly inFlight = new Map<string, Promise<CartographicSystem>>()

  public constructor (
    private readonly source: CartographySource,
    private readonly cache: CartographyCache,
    private readonly runtimeState: RuntimeStateReader,
    private readonly observations: CartographyObservationStore | null = null,
    private readonly maxAgeMs = DEFAULT_MAX_AGE_MS,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async getSystem (
    systemName: string,
    options: CartographyLookupOptions = {}
  ): Promise<CartographyLookupResult> {
    const name = systemName.trim()
    if (!name) throw new Error('A system name is required.')
    const cached = this.cache.getSystem(name)
    if (!options.forceRefresh && cached && this.isFresh(cached)) {
      return { cache: 'fresh', system: this.mergeLocal(this.mergeObservations(cached)) }
    }

    try {
      const system = await this.refresh(name)
      return { cache: 'refreshed', system: this.mergeLocal(this.mergeObservations(system)) }
    } catch (cause) {
      if (cached) return { cache: 'stale', system: this.mergeLocal(this.mergeObservations(cached)) }
      throw cause
    }
  }

  private refresh (name: string): Promise<CartographicSystem> {
    const key = name.toLocaleLowerCase()
    const existing = this.inFlight.get(key)
    if (existing) return existing
    const request = this.source.fetchSystem(name)
      .then(system => {
        this.cache.putSystem(system)
        return system
      })
      .finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request
  }

  private isFresh (system: CartographicSystem): boolean {
    return this.now().getTime() - Date.parse(system.source.fetchedAt) <= this.maxAgeMs
  }

  private mergeLocal (external: CartographicSystem): CartographicSystem {
    const local = this.runtimeState.getCurrent().system
    if (!local.name || local.name.toLocaleLowerCase() !== external.name.toLocaleLowerCase()) return external
    return {
      ...external,
      address: local.address ?? external.address,
      position: local.position ?? external.position,
      information: mergedInformation(external, local),
      localSystem: local
    }
  }

  private mergeObservations (external: CartographicSystem): CartographicSystem {
    const observation = this.observations?.getObservation(external.name)
    if (!observation) return external
    const bodies = [...external.bodies]
    for (const local of observation.bodies) {
      const index = bodies.findIndex(body => body.name.toLocaleLowerCase() === local.bodyName.toLocaleLowerCase())
      const body = index >= 0 ? bodies[index] : bodyFromObservation(local)
      const merged = { ...body, bodyId: local.bodyId ?? body.bodyId, local: localBodyData(local) }
      if (index >= 0) bodies[index] = merged
      else bodies.push(merged)
    }
    const reportedBodies = observation.reportedBodyCount
    return {
      ...external,
      bodies,
      scanProgress: {
        knownBodies: bodies.length,
        reportedBodies,
        percent: reportedBodies && reportedBodies > 0
          ? Math.min(100, Math.floor((bodies.length / reportedBodies) * 100))
          : null
      }
    }
  }
}

function bodyFromObservation (observation: import('../domain/cartography.js').LocalBodyCartographyObservation): CartographicBody {
  const scan = observation.scan ?? {}
  const parents = Array.isArray(scan.Parents)
    ? scan.Parents.filter(item => item !== null && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
    : []
  return {
    id: null,
    id64: null,
    bodyId: observation.bodyId,
    name: observation.bodyName,
    type: typeof scan.StarType === 'string' ? 'Star' : typeof scan.PlanetClass === 'string' ? 'Planet' : null,
    subType: stringField(scan.StarType) ?? stringField(scan.PlanetClass),
    distanceToArrival: nonnegativeNumber(scan.DistanceFromArrivalLS),
    parents,
    local: localBodyData(observation),
    raw: {}
  }
}

function localBodyData (observation: import('../domain/cartography.js').LocalBodyCartographyObservation): NonNullable<CartographicBody['local']> {
  const signalSource = observation.surfaceSignals ?? observation.bodySignals
  return {
    observedAt: observation.observedAt,
    discovered: observation.discovered,
    mapped: observation.mapped,
    surfaceScanCompleted: observation.surfaceScanCompleted,
    signals: signalCounts(signalSource?.Signals),
    biologicalGenuses: Array.isArray(observation.surfaceSignals?.Genuses)
      ? observation.surfaceSignals.Genuses.map(item => {
          const record = item !== null && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
          return stringField(record.Genus_Localised) ?? stringField(record.Genus)
        }).filter((value): value is string => value !== null)
      : [],
    raw: {
      scan: observation.scan,
      bodySignals: observation.bodySignals,
      surfaceSignals: observation.surfaceSignals
    }
  }
}

function signalCounts (candidate: unknown): { biological: number, geological: number, human: number } {
  const counts = { biological: 0, geological: 0, human: 0 }
  if (!Array.isArray(candidate)) return counts
  for (const item of candidate) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
    const signal = item as Record<string, unknown>
    const type = stringField(signal.Type)?.toLocaleLowerCase() ?? ''
    const count = Number.isSafeInteger(signal.Count) && (signal.Count as number) >= 0 ? signal.Count as number : 0
    if (type.includes('biological')) counts.biological = count
    if (type.includes('geological')) counts.geological = count
    if (type.includes('human')) counts.human = count
  }
  return counts
}

function stringField (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
}

function mergedInformation (
  external: CartographicSystem,
  local: CurrentSystem
): CartographicSystem['information'] {
  return {
    allegiance: local.allegiance ?? external.information.allegiance,
    government: local.government?.label ?? local.government?.id ?? external.information.government,
    security: local.security?.label ?? local.security?.id ?? external.information.security,
    state: local.controllingFaction?.state ?? external.information.state,
    primaryEconomy: local.primaryEconomy?.label ?? local.primaryEconomy?.id ?? external.information.primaryEconomy,
    secondaryEconomy: local.secondaryEconomy?.label ?? local.secondaryEconomy?.id ?? external.information.secondaryEconomy,
    population: local.population ?? external.information.population,
    controllingFaction: local.controllingFaction?.name ?? external.information.controllingFaction
  }
}
