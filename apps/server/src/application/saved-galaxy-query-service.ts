import { randomUUID } from 'node:crypto'
import {
  SavedGalaxyQuerySchema,
  SavedGalaxyQueryWriteRequestSchema,
  type GalaxyQueryId,
  type SavedGalaxyQueriesResponse,
  type SavedGalaxyQuery,
  type SavedGalaxyQueryWriteRequest
} from '@phoenix/contracts'
import type { SavedGalaxyQueries, SavedGalaxyQueryRepository } from '../domain/saved-galaxy-queries.js'

export class SavedGalaxyQueryService implements SavedGalaxyQueries {
  public constructor (
    private readonly repository: SavedGalaxyQueryRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID
  ) {}

  public create (input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery {
    const timestamp = this.now().toISOString()
    const query = SavedGalaxyQuerySchema.parse({
      ...normalizeInput(input),
      createdAt: timestamp,
      id: this.createId(),
      schemaVersion: 2,
      updatedAt: timestamp
    })
    this.put(query)
    return query
  }

  public delete (id: string): void {
    this.repository.deleteSavedGalaxyQuery(id)
  }

  public getAll (): SavedGalaxyQueriesResponse {
    return { queries: this.repository.listSavedGalaxyQueries() }
  }

  public getDashboardQuery(queryId: GalaxyQueryId): SavedGalaxyQuery | null {
    return this.repository.listSavedGalaxyQueries().find(query => query.queryId === queryId && query.useOnDashboard) ?? null
  }

  public update (id: string, input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery {
    const existing = this.repository.getSavedGalaxyQuery(id)
    if (!existing) throw new Error(`Saved Galaxy query ${id} does not exist.`)
    const query = SavedGalaxyQuerySchema.parse({
      ...normalizeInput(input),
      createdAt: existing.createdAt,
      id,
      schemaVersion: 2,
      updatedAt: this.now().toISOString()
    })
    this.put(query)
    return query
  }

  private put(query: SavedGalaxyQuery): void {
    if (query.useOnDashboard && query.queryId !== 'market-signals') {
      throw new Error('Only a Market Signals query can be used on the Dashboard.')
    }
    if (query.useOnDashboard) {
      for (const existing of this.repository.listSavedGalaxyQueries()) {
        if (existing.id !== query.id && existing.useOnDashboard) {
          this.repository.putSavedGalaxyQuery({ ...existing, useOnDashboard: false, updatedAt: query.updatedAt })
        }
      }
    }
    this.repository.putSavedGalaxyQuery(query)
  }
}

function normalizeInput (input: SavedGalaxyQueryWriteRequest): SavedGalaxyQueryWriteRequest {
  const validated = SavedGalaxyQueryWriteRequestSchema.parse(input)
  return {
    name: validated.name,
    parameters: Object.fromEntries(Object.entries(validated.parameters).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value
    ])),
    queryId: validated.queryId,
    useOnDashboard: validated.useOnDashboard
  }
}
