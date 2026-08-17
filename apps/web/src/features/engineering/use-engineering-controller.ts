import { useEffect, useState } from 'react'
import type {
  EngineeringBlueprintDetail,
  EngineeringBlueprintsResponse,
  EngineeringEngineersResponse,
  EngineeringMaterialsResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

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
  const [snapshot, setSnapshot] = useState<EngineeringControllerSnapshot>({ status: 'idle' })

  useEffect(() => {
    const abort = new AbortController()
    setSnapshot({ status: 'loading' })
    const request = view === 'engineers'
      ? api.getEngineeringEngineers(abort.signal).then(engineers => ({ engineers }))
      : view.startsWith('materials-')
        ? api.getEngineeringMaterials(view.slice('materials-'.length) as 'raw' | 'manufactured' | 'encoded' | 'xeno', abort.signal).then(materials => ({ materials }))
        : selectedBlueprintSymbol
          ? api.getEngineeringBlueprint(selectedBlueprintSymbol, abort.signal).then(blueprint => ({ blueprint }))
          : api.getEngineeringBlueprints(abort.signal).then(blueprints => ({ blueprints }))
    void request.then(result => {
      if (!abort.signal.aborted) setSnapshot({ ...result, status: 'ready' })
    }).catch(cause => {
      if (!abort.signal.aborted) setSnapshot({ error: cause instanceof Error ? cause.message : 'Engineering data unavailable.', status: 'error' })
    })
    return () => abort.abort()
  }, [api, revision, selectedBlueprintSymbol, view])

  return snapshot
}
