// Entry-count budget for transient browser data, not a byte limit. Keep enough recent
// views for navigation while preventing system/query history from growing all session.
export const DEFAULT_BROWSER_CACHE_ENTRIES = 64

export class BoundedCache<T> {
  readonly #entries = new Map<string, T>()

  constructor(private readonly maxEntries = DEFAULT_BROWSER_CACHE_ENTRIES) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError('Cache capacity must be a positive integer.')
  }

  get(key: string): T | undefined {
    if (!this.#entries.has(key)) return undefined
    const value = this.#entries.get(key)!
    this.#entries.delete(key)
    this.#entries.set(key, value)
    return value
  }

  set(key: string, value: T): T {
    this.#entries.delete(key)
    this.#entries.set(key, value)
    if (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value
      if (oldest !== undefined) this.#entries.delete(oldest)
    }
    return value
  }
}
