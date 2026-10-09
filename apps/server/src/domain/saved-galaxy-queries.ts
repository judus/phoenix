import type {
  GalaxyQueryId,
  SavedGalaxyQueriesResponse,
  SavedGalaxyQuery,
  SavedGalaxyQueryWriteRequest
} from '@phoenix/contracts'

export type PredefinedGalaxyQuery = SavedGalaxyQueryWriteRequest & { id: string }

export interface SavedGalaxyQueryRepository {
  deleteSavedGalaxyQuery(id: string): void
  getSavedGalaxyQuery(id: string): SavedGalaxyQuery | null
  listSavedGalaxyQueries(): SavedGalaxyQuery[]
  putSavedGalaxyQuery(query: SavedGalaxyQuery): void
  insertMissingSavedGalaxyQueries(queries: SavedGalaxyQuery[]): number
}

export interface SavedGalaxyQueries {
  create(input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery
  delete(id: string): void
  getDashboardQuery(queryId: GalaxyQueryId): SavedGalaxyQuery | null
  getAll(): SavedGalaxyQueriesResponse
  importPredefined(): SavedGalaxyQueriesResponse
  update(id: string, input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery
}
