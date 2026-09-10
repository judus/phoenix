import type { CartographicSystem } from '@phoenix/contracts'
import type {
  CartographyRecord,
  CartographyLookupOptions,
  CartographyLookupResult,
  CartographyRepository,
  ExternalCartographySource,
  SystemCartography
} from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import { projectCartographicSystem } from './cartographic-system-projector.js'

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export class SystemCartographyService implements SystemCartography {
  private readonly inFlight = new Map<string, Promise<CartographyRecord>>()

  public constructor (
    private readonly source: ExternalCartographySource,
    private readonly repository: CartographyRepository,
    private readonly runtimeState: RuntimeStateReader,
    private readonly maxAgeMs = DEFAULT_MAX_AGE_MS,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async getSystem (
    systemName: string,
    options: CartographyLookupOptions = {}
  ): Promise<CartographyLookupResult> {
    const name = systemName.trim()
    if (!name) throw new Error('A system name is required.')
    const record = this.repository.findRecord(name)
    if (!options.forceRefresh && record?.external && this.isFresh(record.external)) {
      return { cache: 'fresh', system: projectCartographicSystem(record, this.runtimeState.getCurrent().system) }
    }

    try {
      const refreshed = await this.refresh(name)
      return {
        cache: 'refreshed',
        system: projectCartographicSystem(refreshed, this.runtimeState.getCurrent().system)
      }
    } catch (cause) {
      if (record?.external) {
        return { cache: 'stale', system: projectCartographicSystem(record, this.runtimeState.getCurrent().system) }
      }
      if (record?.local) {
        return { cache: 'local', system: projectCartographicSystem(record, this.runtimeState.getCurrent().system) }
      }
      throw cause
    }
  }

  private refresh (name: string): Promise<CartographyRecord> {
    const key = name.toLocaleLowerCase()
    const existing = this.inFlight.get(key)
    if (existing) return existing
    const request = this.source.fetchSystem(name)
      .then(system => {
        this.repository.putExternalSystem(system)
        const record = this.repository.findRecord(system.name)
        if (!record?.external) throw new Error(`External cartography for "${system.name}" was not persisted.`)
        return record
      })
      .finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request
  }

  private isFresh (system: CartographicSystem): boolean {
    const fetchedAt = system.provenance.edsm?.fetchedAt
    return fetchedAt !== undefined && this.now().getTime() - Date.parse(fetchedAt) <= this.maxAgeMs
  }
}
