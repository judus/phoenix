import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PersonalEquipmentPlanPreviewRequest, PersonalEquipmentPlanPreviewResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { usePersonalEquipmentPlannerController, type PersonalEquipmentPlannerControllerSnapshot } from '../apps/web/src/features/equipment/use-personal-equipment-planner-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const request: PersonalEquipmentPlanPreviewRequest = {
  source: { kind: 'catalogue', equipmentId: 'utilitysuit', currentGrade: 1 }, targetGrade: 3, plannedModificationIds: []
}

test('an older preview cannot finish a newer pending preview', async () => {
  const first = deferred<PersonalEquipmentPlanPreviewResponse>()
  const second = deferred<PersonalEquipmentPlanPreviewResponse>()
  const api = plannerApi()
  api.previewPersonalEquipmentPlan.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const harness = await mountPlanner(api)
  try {
    await act(async () => { void harness.snapshot().createPreview(request) })
    await act(async () => { void harness.snapshot().createPreview({ ...request, targetGrade: 5 }) })
    expect(api.previewPersonalEquipmentPlan.mock.calls[0]?.[1]?.aborted).toBe(true)
    expect(api.previewPersonalEquipmentPlan.mock.calls[1]?.[1]?.aborted).toBe(false)
    await act(async () => { first.resolve(preview('old')) })
    expect(harness.snapshot()).toMatchObject({ previewing: true })
    expect(harness.snapshot().preview).toBeUndefined()
    await act(async () => { second.resolve(preview('new')) })
    expect(harness.snapshot()).toMatchObject({ preview: preview('new'), previewing: false })
  } finally { await harness.unmount() }
})

test.each(['resolve', 'reject'] as const)('an obsolete preview %s cannot overwrite a newer result', async settlement => {
  const old = deferred<PersonalEquipmentPlanPreviewResponse>()
  const api = plannerApi()
  api.previewPersonalEquipmentPlan.mockReturnValueOnce(old.promise).mockResolvedValueOnce(preview('new'))
  const harness = await mountPlanner(api)
  try {
    await act(async () => { void harness.snapshot().createPreview(request) })
    await act(async () => { await harness.snapshot().createPreview({ ...request, targetGrade: 5 }) })
    await act(async () => { settlement === 'resolve' ? old.resolve(preview('old')) : old.reject(new Error('Obsolete error')) })
    expect(harness.snapshot()).toMatchObject({ preview: preview('new'), previewing: false })
    expect(harness.snapshot().error).toBeUndefined()
  } finally { await harness.unmount() }
})

test.each(['deactivation', 'api replacement'] as const)('a noncooperative preview cannot repopulate reset state after %s', async reset => {
  const old = deferred<PersonalEquipmentPlanPreviewResponse>()
  const api = plannerApi()
  api.previewPersonalEquipmentPlan.mockReturnValue(old.promise)
  const harness = await mountPlanner(api)
  try {
    await act(async () => { void harness.snapshot().createPreview(request) })
    if (reset === 'deactivation') {
      await harness.update(api, false)
      await harness.update(api, true)
    } else {
      await harness.update(plannerApi(), true)
    }
    const resetSnapshot = harness.snapshot()
    await act(async () => { old.resolve(preview('old')) })
    expect(harness.snapshot()).toBe(resetSnapshot)
    expect(harness.snapshot().preview).toBeUndefined()
  } finally { await harness.unmount() }
})

test('unmount aborts a preview even when the provider ignores cancellation', async () => {
  const pending = deferred<PersonalEquipmentPlanPreviewResponse>()
  const api = plannerApi()
  api.previewPersonalEquipmentPlan.mockReturnValue(pending.promise)
  const harness = await mountPlanner(api)
  try {
    await act(async () => { void harness.snapshot().createPreview(request) })
    const signal = api.previewPersonalEquipmentPlan.mock.calls[0]?.[1]
    expect(signal?.aborted).toBe(false)
    await harness.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { pending.resolve(preview('late')) })
  } finally { await harness.unmount() }
})

test('a current failure is shown and inactive planner calls do not send requests', async () => {
  const api = plannerApi()
  api.previewPersonalEquipmentPlan.mockRejectedValue(new Error('Current failure'))
  const harness = await mountPlanner(api)
  try {
    await act(async () => { await harness.snapshot().createPreview(request) })
    expect(harness.snapshot()).toMatchObject({ error: 'Current failure', previewing: false })
    await harness.update(api, false)
    await act(async () => { await harness.snapshot().createPreview(request) })
    expect(api.previewPersonalEquipmentPlan).toHaveBeenCalledTimes(1)
  } finally { await harness.unmount() }
})

function plannerApi() {
  return {
    getPersonalEquipmentPlannerOptions: vi.fn().mockResolvedValue({ schemaVersion: 1, catalogueVersion: 'test', generatedAt: '2026-10-04T12:00:00Z', equipment: [] }),
    previewPersonalEquipmentPlan: vi.fn<(input: PersonalEquipmentPlanPreviewRequest, signal?: AbortSignal) => Promise<PersonalEquipmentPlanPreviewResponse>>()
  }
}

async function mountPlanner(api: ReturnType<typeof plannerApi>) {
  let snapshot: PersonalEquipmentPlannerControllerSnapshot
  function Probe({ api, active }: { api: ReturnType<typeof plannerApi>, active: boolean }) {
    snapshot = usePersonalEquipmentPlannerController(api as unknown as PhoenixApi, active)
    return null
  }
  const renderer = await renderWithAct(<Probe api={api} active />)
  return {
    snapshot: () => snapshot,
    update: async (api: ReturnType<typeof plannerApi>, active: boolean) => {
      await act(async () => { renderer.update(<Probe api={api} active={active} />) })
    },
    unmount: async () => { await act(async () => { renderer.unmount() }) }
  }
}

function preview(id: string): PersonalEquipmentPlanPreviewResponse {
  return {
    schemaVersion: 1, catalogueVersion: 'test', equipment: { id, name: id, kind: 'suit', source: 'catalogue' },
    currentGrade: 1, targetGrade: 3, slots: { current: 0, target: 2, installed: 0, planned: 0, remaining: 2 },
    steps: [], materials: [], credits: { knownSubtotal: 0, total: 0, complete: true }, specialists: [], unresolvedInstalledModifications: []
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
