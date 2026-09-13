import { randomUUID } from 'node:crypto'
import {
  SavedGalaxyQuerySchema,
  SavedGalaxyQueryWriteRequestSchema,
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
      schemaVersion: 1,
      updatedAt: timestamp
    })
    this.repository.putSavedGalaxyQuery(query)
    return query
  }

  public delete (id: string): void {
    this.repository.deleteSavedGalaxyQuery(id)
  }

  public getAll (): SavedGalaxyQueriesResponse {
    return { queries: this.repository.listSavedGalaxyQueries() }
  }

  public update (id: string, input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery {
    const existing = this.repository.getSavedGalaxyQuery(id)
    if (!existing) throw new Error(`Saved Galaxy query ${id} does not exist.`)
    const query = SavedGalaxyQuerySchema.parse({
      ...normalizeInput(input),
      createdAt: existing.createdAt,
      id,
      schemaVersion: 1,
      updatedAt: this.now().toISOString()
    })
    this.repository.putSavedGalaxyQuery(query)
    return query
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
    queryId: validated.queryId
  }
}
