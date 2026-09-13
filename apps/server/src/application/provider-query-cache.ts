import type { ProviderResponseCache } from '../domain/station-market.js'

export interface CachedProviderResult<T> {
  cache: 'fresh' | 'refreshed' | 'stale'
  value: T
}

export class ProviderQueryCache {
  private readonly inFlight = new Map<string, Promise<unknown>>()

  public constructor (
    private readonly cache: ProviderResponseCache,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async get<T> (
    namespace: string,
    key: string,
    maxAgeMs: number,
    load: () => Promise<T>,
    validate: (candidate: unknown) => candidate is T
  ): Promise<CachedProviderResult<T>> {
    const existing = this.cache.getProviderResponse(namespace, key)
    if (existing && validate(existing.value) && this.now().getTime() - Date.parse(existing.fetchedAt) <= maxAgeMs) {
      return { cache: 'fresh', value: existing.value }
    }
    const inFlightKey = `${namespace}:${key}`
    const active = this.inFlight.get(inFlightKey)
    try {
      const value = active ? await active : await this.refresh(inFlightKey, load)
      if (!validate(value)) throw new Error(`Invalid cached provider response for ${namespace}.`)
      return { cache: 'refreshed', value }
    } catch (cause) {
      if (existing && validate(existing.value)) return { cache: 'stale', value: existing.value }
      throw cause
    }
  }

  private refresh<T> (key: string, load: () => Promise<T>): Promise<T> {
    const request = load().then(value => {
      const [namespace, ...parts] = key.split(':')
      this.cache.putProviderResponse(namespace!, parts.join(':'), this.now().toISOString(), value)
      return value
    }).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request
  }
}
