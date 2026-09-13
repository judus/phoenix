import type {
  GalaxyQueryId,
  SavedGalaxyQueriesResponse,
  SavedGalaxyQuery,
  SavedGalaxyQueryWriteRequest
} from '@phoenix/contracts'

export interface SavedGalaxyQueryRepository {
  deleteSavedGalaxyQuery(id: string): void
  getSavedGalaxyQuery(id: string): SavedGalaxyQuery | null
  listSavedGalaxyQueries(): SavedGalaxyQuery[]
  putSavedGalaxyQuery(query: SavedGalaxyQuery): void
}

export interface SavedGalaxyQueries {
  create(input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery
  delete(id: string): void
  getDashboardQuery(queryId: GalaxyQueryId): SavedGalaxyQuery | null
  getAll(): SavedGalaxyQueriesResponse
  update(id: string, input: SavedGalaxyQueryWriteRequest): SavedGalaxyQuery
}
