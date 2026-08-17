import { useEffect, useState } from 'react'
import type {
  EngineeringBlueprintDetail,
  EngineeringBlueprintsResponse,
  EngineeringEngineersResponse,
  EngineeringMaterialsResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'

export type EngineeringView = 'blueprints' | 'engineers' | 'materials-raw' | 'materials-manufactured' | 'materials-encoded' | 'materials-xeno'

export interface EngineeringControllerSnapshot {
  blueprint?: EngineeringBlueprintDetail
  blueprints?: EngineeringBlueprintsResponse
  engineers?: EngineeringEngineersResponse
  error?: string
  materials?: EngineeringMaterialsResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useEngineeringController(
  api: PhoenixApi,
  view: EngineeringView,
  selectedBlueprintSymbol?: string,
  revision?: number
): EngineeringControllerSnapshot {
  const cacheKey = `engineering:${view}:${selectedBlueprintSymbol ?? ''}`
  const [snapshot, setSnapshot] = useState<EngineeringControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  useEffect(() => {
    const abort = new AbortController()
    const retained = readControllerSnapshot<EngineeringControllerSnapshot>(api, cacheKey)
    setSnapshot(retained ?? { status: 'loading' })
    const request = view === 'engineers'
      ? api.getEngineeringEngineers(abort.signal).then(engineers => ({ engineers }))
      : view.startsWith('materials-')
        ? api.getEngineeringMaterials(view.slice('materials-'.length) as 'raw' | 'manufactured' | 'encoded' | 'xeno', abort.signal).then(materials => ({ materials }))
        : selectedBlueprintSymbol
          ? api.getEngineeringBlueprint(selectedBlueprintSymbol, abort.signal).then(blueprint => ({ blueprint }))
          : api.getEngineeringBlueprints(abort.signal).then(blueprints => ({ blueprints }))
    void request.then(result => {
      if (!abort.signal.aborted) setSnapshot(storeControllerSnapshot(api, cacheKey, { ...result, status: 'ready' }))
    }).catch(cause => {
      if (!abort.signal.aborted) {
        const error = cause instanceof Error ? cause.message : 'Engineering data unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, error } : { error, status: 'error' })
      }
    })
    return () => abort.abort()
  }, [api, cacheKey, revision, selectedBlueprintSymbol, view])

  return snapshot
}
