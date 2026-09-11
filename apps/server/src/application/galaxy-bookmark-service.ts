import { randomUUID } from 'node:crypto'
import {
  GalaxyBookmarkSchema,
  GalaxyBookmarkWriteRequestSchema,
  type GalaxyBookmark,
  type GalaxyBookmarkWriteRequest,
  type GalaxyBookmarksResponse
} from '@phoenix/contracts'
import type { GalaxyBookmarkRepository, GalaxyBookmarks } from '../domain/galaxy-bookmarks.js'

export class GalaxyBookmarkService implements GalaxyBookmarks {
  public constructor (
    private readonly repository: GalaxyBookmarkRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID
  ) {}

  public create (input: GalaxyBookmarkWriteRequest): GalaxyBookmark {
    const normalized = normalizeInput(input)
    const existing = this.repository.findGalaxyBookmarkByTarget(normalized.target)
    if (existing) return this.update(existing.id, normalized)
    const timestamp = this.now().toISOString()
    const bookmark = GalaxyBookmarkSchema.parse({
      ...normalized,
      createdAt: timestamp,
      id: this.createId(),
      updatedAt: timestamp
    })
    this.repository.putGalaxyBookmark(bookmark)
    return bookmark
  }

  public delete (id: string): void {
    this.repository.deleteGalaxyBookmark(id)
  }

  public getAll (): GalaxyBookmarksResponse {
    return { bookmarks: this.repository.listGalaxyBookmarks() }
  }

  public update (id: string, input: GalaxyBookmarkWriteRequest): GalaxyBookmark {
    const existing = this.repository.getGalaxyBookmark(id)
    if (!existing) throw new Error(`Galaxy bookmark ${id} does not exist.`)
    const normalized = normalizeInput(input)
    const conflicting = this.repository.findGalaxyBookmarkByTarget(normalized.target)
    if (conflicting && conflicting.id !== id) {
      throw new Error('That system or body is already bookmarked.')
    }
    const bookmark = GalaxyBookmarkSchema.parse({
      ...normalized,
      createdAt: existing.createdAt,
      id,
      updatedAt: this.now().toISOString()
    })
    this.repository.putGalaxyBookmark(bookmark)
    return bookmark
  }
}

function normalizeInput (input: GalaxyBookmarkWriteRequest): GalaxyBookmarkWriteRequest {
  const validated = GalaxyBookmarkWriteRequestSchema.parse(input)
  const uniqueTags = new Map<string, string>()
  for (const tag of validated.tags) {
    const key = tag.toLocaleLowerCase()
    if (!uniqueTags.has(key)) uniqueTags.set(key, tag)
  }
  const tags = [...uniqueTags.values()].sort((left, right) => left.localeCompare(right))
  return {
    note: validated.note || null,
    tags,
    target: validated.target
  }
}
