import { useEffect, useState } from 'react'
import type { CommunityGoalsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { AtlasMarker, GalacticPosition } from './galactic-atlas-model.js'

interface AtlasCommunityGoalsState {
  markers: AtlasMarker[]
  snapshot?: CommunityGoalsResponse
  loading: boolean
  error?: string
  unlocatedSystems: string[]
}

export function useAtlasCommunityGoals(api: PhoenixApi, enabled: boolean): AtlasCommunityGoalsState {
  const [state, setState] = useState<AtlasCommunityGoalsState>({ markers: [], loading: false, unlocatedSystems: [] })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const { signal } = controller
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    setState({ markers: [], loading: true, unlocatedSystems: [] })
    const load = async () => {
      try {
        const snapshot = await api.getCommunityGoals(signal)
        if (signal.aborted) return
        const systems = new Map(snapshot.goals.map(goal => [systemKey(goal.systemName), goal.systemName]))
        const queue = [...systems.entries()]
        const positions = new Map<string, GalacticPosition>()
        const unlocatedSystems: string[] = []
        const worker = async () => {
          while (!signal.aborted && queue.length) {
            const [key, name] = queue.shift()!
            try {
              const result = await api.getSystemCartography(name, signal)
              if (result.system.position) positions.set(key, result.system.position)
              else unlocatedSystems.push(name)
            } catch {
              // A failed coordinate lookup must not hide other campaigns or invent a map point.
              unlocatedSystems.push(name)
            }
          }
        }
        await Promise.all([worker(), worker()])
        if (signal.aborted) return
        const markers = snapshot.goals.flatMap(goal => {
          const position = positions.get(systemKey(goal.systemName))
          return position ? [{ id: `community-goal:${goal.id}`, kind: 'community-goal' as const,
            label: `CG · ${goal.title}`, systemName: goal.systemName, selectedName: goal.stationName,
            position, communityGoal: goal }] : []
        })
        setState({ markers, snapshot, loading: false, unlocatedSystems })
      } catch (cause) {
        if (!signal.aborted) setState(current => ({ ...current, loading: false,
          error: cause instanceof Error ? cause.message : 'Community Goals unavailable.' }))
      } finally {
        if (!signal.aborted) refreshTimer = setTimeout(() => { void load() }, 15 * 60 * 1000 + 1000)
      }
    }
    void load()
    return () => {
      controller.abort()
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
    }
  }, [api, enabled])
  return state
}

function systemKey(name: string): string { return name.trim().toLowerCase() }
