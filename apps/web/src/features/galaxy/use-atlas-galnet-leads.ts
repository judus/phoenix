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
    setState({ markers: [], loading: true, unlocatedSystems: [] })
    void (async () => {
      try {
        const snapshot = await api.getGalnetInvestigationLeads(signal)
        if (signal.aborted) return
        const queue = [...new Map(snapshot.leads.map(lead => [key(lead.systemName), lead.systemName])).entries()]
        const positions = new Map<string, GalacticPosition>()
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
        setState({ markers, snapshot, loading: false, unlocatedSystems })
      } catch (cause) {
        if (!signal.aborted) setState(current => ({ ...current, loading: false,
          error: cause instanceof Error ? cause.message : 'Saved GalNet leads unavailable.' }))
      }
    })()
    return () => controller.abort()
  }, [api, enabled])
  return state
}

function key(name: string): string { return name.trim().toLowerCase() }
