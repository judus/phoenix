import type {
  GalaxyBookmark,
  GalaxyBookmarkTarget,
  GalaxyBookmarksResponse,
  GalaxyBookmarkWriteRequest
} from '@phoenix/contracts'

export interface GalaxyBookmarkRepository {
  deleteGalaxyBookmark(id: string): void
  findGalaxyBookmarkByTarget(target: GalaxyBookmarkTarget): GalaxyBookmark | null
  getGalaxyBookmark(id: string): GalaxyBookmark | null
  listGalaxyBookmarks(): GalaxyBookmark[]
  putGalaxyBookmark(bookmark: GalaxyBookmark): void
}

export interface GalaxyBookmarks {
  create(input: GalaxyBookmarkWriteRequest): GalaxyBookmark
  delete(id: string): void
  getAll(): GalaxyBookmarksResponse
  update(id: string, input: GalaxyBookmarkWriteRequest): GalaxyBookmark
}

export function galaxyBookmarkTargetKey(target: GalaxyBookmarkTarget): string {
  const system = normalizeIdentity(target.systemName)
  return target.kind === 'system'
    ? `system:${system}`
    : `body:${system}:${normalizeIdentity(target.bodyName)}`
}

function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase()
}
