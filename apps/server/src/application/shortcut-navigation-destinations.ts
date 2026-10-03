import { randomUUID } from 'node:crypto'
import type { GalaxyBookmarks } from '../domain/galaxy-bookmarks.js'
import type { SavedGalaxyQueries } from '../domain/saved-galaxy-queries.js'
import type { NavigationCommandDestination } from '../domain/commands.js'
import { PHOENIX_NAVIGATION_DESTINATIONS } from './default-command-registry.js'

/** Targets store IDs only. Resolve the latest saved data on every execution. */
export function shortcutNavigationDestinations (
  bookmarks: GalaxyBookmarks,
  queries: SavedGalaxyQueries,
  createRunId: () => string = randomUUID
): NavigationCommandDestination[] {
  return [
    ...PHOENIX_NAVIGATION_DESTINATIONS,
    ...queries.getAll().queries.map(query => ({
      id: `saved-query:${query.id}`,
      category: 'Saved queries',
      label: query.name,
      description: `Run saved query: ${query.name}.`,
      href: `#/galaxy/database?${new URLSearchParams({ query: query.queryId, saved: query.id, run: createRunId() })}`
    })),
    ...bookmarks.getAll().bookmarks.map(bookmark => {
      const target = bookmark.target
      const selected = target.kind === 'station' ? target.stationName : target.kind === 'body' ? target.bodyName : undefined
      return {
        id: `bookmark:${bookmark.id}`,
        category: 'Bookmarks',
        label: selected ? `${selected} · ${target.systemName}` : target.systemName,
        description: 'Open bookmarked location in the system schematic.',
        href: `#/galaxy/system?${new URLSearchParams({ name: target.systemName, ...(selected ? { selected } : {}) })}`
      }
    })
  ]
}
