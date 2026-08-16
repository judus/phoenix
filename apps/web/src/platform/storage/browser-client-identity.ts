import { createClientId, type ClientIdentity } from '../../application/identity/client-identity.js'

export class BrowserClientIdentity implements ClientIdentity {
  readonly #storage: Storage
  readonly #fallback = new Map<string, string>()

  constructor(storage: Storage) {
    this.#storage = storage
  }

  forScope(scope: 'copilot' | 'macros'): string {
    const key = `phoenix.${scope}.client-id`
    const fallback = this.#fallback.get(key)
    if (fallback) return fallback
    try {
      const existing = this.#storage.getItem(key)
      if (existing) return existing
      const created = createClientId()
      this.#storage.setItem(key, created)
      return created
    } catch {
      const created = createClientId()
      this.#fallback.set(key, created)
      return created
    }
  }
}
