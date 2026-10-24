import { useEffect, useState } from 'react'
import type { GalnetInvestigationLeadsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { AtlasMarker, GalacticPosition } from './galactic-atlas-model.js'

interface State {
  markers: AtlasMarker[]
  snapshot?: GalnetInvestigationLeadsResponse
  loading: boolean
  error?: string
  unlocatedSystems: string[]
}

export function useAtlasGalnetLeads(api: PhoenixApi, enabled: boolean): State {
  const [state, setState] = useState<State>({ markers: [], loading: false, unlocatedSystems: [] })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const { signal } = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    let previousSnapshot: string | undefined
    const positions = new Map<string, GalacticPosition>()
    setState(current => ({ ...current, loading: true, error: undefined }))
    const refresh = async () => {
      try {
        const snapshot = await api.getGalnetInvestigationLeads(signal)
        if (signal.aborted) return
        const revision = JSON.stringify(snapshot)
        if (revision === previousSnapshot) {
          setState(current => ({ ...current, loading: false, error: undefined }))
          return
        }
        const queue = [...new Map(snapshot.leads.map(lead => [key(lead.systemName), lead.systemName])).entries()]
          .filter(([id]) => !positions.has(id))
        const unlocatedSystems: string[] = []
        const worker = async () => {
          while (!signal.aborted && queue.length) {
            const [id, name] = queue.shift()!
            try {
              const result = await api.getSystemCartography(name, signal)
              if (key(result.system.name) === id && result.system.position) positions.set(id, result.system.position)
              else unlocatedSystems.push(name)
            } catch { unlocatedSystems.push(name) }
          }
        }
        await Promise.all([worker(), worker()])
        if (signal.aborted) return
        const markers = snapshot.leads.flatMap(lead => {
          const position = positions.get(key(lead.systemName))
          return position ? [{ id: lead.id, kind: 'investigation' as const, label: `Lead · ${lead.title}`,
            systemName: lead.systemName, position, investigation: lead }] : []
        })
        previousSnapshot = revision
        setState({ markers, snapshot, loading: false, unlocatedSystems })
      } catch (cause) {
        if (!signal.aborted) setState(current => ({ ...current, loading: false,
          error: cause instanceof Error ? cause.message : 'Saved GalNet leads unavailable.' }))
      } finally {
        if (!signal.aborted) timer = setTimeout(() => { void refresh() }, 5_000)
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [api, enabled])
  return state
}

function key(name: string): string { return name.trim().toLowerCase() }
