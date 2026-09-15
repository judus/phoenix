import { useCallback, useEffect, useState } from 'react'
import type {
  PersonalEquipmentPlannerOptionsResponse,
  PersonalEquipmentPlanPreviewRequest,
  PersonalEquipmentPlanPreviewResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export interface PersonalEquipmentPlannerControllerSnapshot {
  error?: string
  options?: PersonalEquipmentPlannerOptionsResponse
  preview?: PersonalEquipmentPlanPreviewResponse
  previewing: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  createPreview(request: PersonalEquipmentPlanPreviewRequest): Promise<void>
}

export function usePersonalEquipmentPlannerController (
  api: PhoenixApi,
  active: boolean
): PersonalEquipmentPlannerControllerSnapshot {
  const [snapshot, setSnapshot] = useState<Omit<PersonalEquipmentPlannerControllerSnapshot, 'createPreview'>>({
    previewing: false,
    status: 'idle'
  })

  useEffect(() => {
    if (!active) return
    const latest = new LatestRequest()
    const signal = latest.start()
    setSnapshot({ previewing: false, status: 'loading' })
    void api.getPersonalEquipmentPlannerOptions(signal).then(options => {
      if (latest.isCurrent(signal)) setSnapshot({ options, previewing: false, status: 'ready' })
    }).catch((cause: unknown) => {
      if (!latest.isCurrent(signal)) return
      setSnapshot({
        error: cause instanceof Error ? cause.message : 'Personal equipment planner unavailable.',
        previewing: false,
        status: 'error'
      })
    })
    return () => latest.cancel()
  }, [active, api])

  const createPreview = useCallback(async (request: PersonalEquipmentPlanPreviewRequest) => {
    setSnapshot(current => ({ ...current, error: undefined, previewing: true, preview: undefined }))
    try {
      const preview = await api.previewPersonalEquipmentPlan(request)
      setSnapshot(current => ({ ...current, preview, previewing: false, status: 'ready' }))
    } catch (cause) {
      setSnapshot(current => ({
        ...current,
        error: cause instanceof Error ? cause.message : 'Upgrade preview could not be created.',
        previewing: false
      }))
    }
  }, [api])

  return { ...snapshot, createPreview }
}
