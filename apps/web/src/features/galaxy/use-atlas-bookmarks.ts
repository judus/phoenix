import { useEffect, useState } from 'react'
import type { GalaxyBookmark } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { ATLAS_LANDMARKS, type AtlasMarker } from './galactic-atlas-model.js'

export function useAtlasBookmarks(api: PhoenixApi, enabled: boolean) {
  const [state, setState] = useState<{ markers: AtlasMarker[], pending: number, unresolved: number, missingSystems: string[], failures: string[], error?: string }>({ markers: [], pending: 0, unresolved: 0, missingSystems: [], failures: [] })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const { signal } = controller
    setState(current => ({ ...current, pending: 0, error: undefined }))
    void api.getGalaxyBookmarks(signal).then(async ({ bookmarks }) => {
      const groups = new Map<string, GalaxyBookmark[]>()
      for (const bookmark of bookmarks) {
        const key = bookmark.target.systemName.trim().toLowerCase()
        groups.set(key, [...(groups.get(key) ?? []), bookmark])
      }
      const queue = [...groups.values()]
      if (signal.aborted) return
      setState(current => ({ ...current, pending: bookmarks.length }))
      const refreshed = { markers: [] as AtlasMarker[], pending: 0, unresolved: 0, missingSystems: [] as string[], failures: [] as string[] }
      const worker = async () => {
        while (!signal.aborted && queue.length) {
          const entries = queue.shift()!
          const systemName = entries[0].target.systemName
          let position = ATLAS_LANDMARKS.find(marker => marker.systemName.toLowerCase() === systemName.toLowerCase())?.position
          let failure: string | undefined
          try { position ??= (await api.getSystemCartography(systemName, signal)).system.position ?? undefined } catch (cause) {
            failure = `${systemName}: ${cause instanceof Error ? cause.message : 'Lookup failed'}`
          }
          if (signal.aborted) return
          const markers: AtlasMarker[] = position ? entries.map(bookmark => ({
            id: bookmark.id, kind: 'bookmark', systemName, position: position!,
            label: bookmark.target.kind === 'station' ? bookmark.target.stationName : bookmark.target.kind === 'body' ? bookmark.target.bodyName : systemName,
            ...(bookmark.target.kind === 'station' ? { selectedName: bookmark.target.stationName } : bookmark.target.kind === 'body' ? { selectedName: bookmark.target.bodyName } : {})
          })) : []
          refreshed.markers.push(...markers)
          if (!position && !failure) {
            refreshed.unresolved += entries.length
            refreshed.missingSystems.push(systemName)
          }
          if (failure) refreshed.failures.push(failure)
          setState(current => ({ ...current, pending: current.pending - entries.length }))
        }
      }
      // Reuse authoritative cached cartography, deduplicate systems and limit provider pressure.
      await Promise.all([worker(), worker()])
      if (!signal.aborted) setState(refreshed)
    }).catch(cause => {
      if (!signal.aborted) setState(current => ({ ...current, pending: 0, error: cause instanceof Error ? cause.message : 'Bookmarks unavailable.' }))
    })
    return () => controller.abort()
  }, [api, enabled])
  return state
}
