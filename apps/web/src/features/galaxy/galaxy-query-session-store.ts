import type { GalaxyQueryValue } from './galaxy-query-catalogue.js'
import type { GalaxyQueryResult } from './galaxy-query-results.js'

export interface GalaxyQuerySession {
  executionId?: string
  result?: GalaxyQueryResult
  values: Readonly<Record<string, GalaxyQueryValue>>
}

export class GalaxyQuerySessionStore {
  readonly #sessions = new Map<string, GalaxyQuerySession>()

  get(sessionId: string): GalaxyQuerySession | undefined {
    return this.#sessions.get(sessionId)
  }

  set(sessionId: string, session: GalaxyQuerySession): void {
    this.#sessions.set(sessionId, { ...session, values: { ...session.values } })
  }
}
