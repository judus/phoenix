import { BoundedCache } from '../../application/cache/bounded-cache.js'
import { GALAXY_QUERY_CATALOGUE, type GalaxyQueryValue } from './galaxy-query-catalogue.js'
import type { GalaxyQueryResult } from './galaxy-query-results.js'

export interface GalaxyQuerySession {
  executionId?: string
  result?: GalaxyQueryResult
  values: Readonly<Record<string, GalaxyQueryValue>>
}

export class GalaxyQuerySessionStore {
  // The finite default query editors retain unsaved drafts independently of history.
  readonly #defaultSessionIds = new Set<string>(GALAXY_QUERY_CATALOGUE.map(query => query.id))
  readonly #drafts = new Map<string, GalaxyQuerySession>()
  readonly #sessions = new BoundedCache<GalaxyQuerySession>()

  get(sessionId: string): GalaxyQuerySession | undefined {
    return this.#defaultSessionIds.has(sessionId) ? this.#drafts.get(sessionId) : this.#sessions.get(sessionId)
  }

  set(sessionId: string, session: GalaxyQuerySession): void {
    const copy = { ...session, values: { ...session.values } }
    if (this.#defaultSessionIds.has(sessionId)) this.#drafts.set(sessionId, copy)
    else this.#sessions.set(sessionId, copy)
  }
}
