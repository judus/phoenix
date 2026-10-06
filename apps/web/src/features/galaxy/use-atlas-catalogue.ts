import { useEffect, useState } from 'react'
import type { AtlasCatalogueResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function useAtlasCatalogue(api: PhoenixApi) {
  const [state, setState] = useState<{ catalogue?: AtlasCatalogueResponse, error?: string, loading: boolean }>({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true })
    void api.getAtlasCatalogue(controller.signal).then(catalogue => {
      if (!controller.signal.aborted) setState({ catalogue, loading: false })
    }).catch(cause => {
      if (!controller.signal.aborted) setState({ loading: false, error: cause instanceof Error ? cause.message : 'POI catalogue unavailable.' })
    })
    return () => controller.abort()
  }, [api])
  return state
}
