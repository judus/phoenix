import { act, create } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import type { GameActionCatalogResponse, GameActionResult } from '@phoenix/contracts'
import { DashboardCommandControls } from '../apps/web/src/features/dashboard/dashboard-command-controls.js'

test('dashboard commands control voice, radio, and the next route target while docking remains unavailable', async () => {
  const connect = vi.fn(() => Promise.resolve())
  const disconnect = vi.fn()
  const onExecute = vi.fn((actionId: string) => Promise.resolve(result(actionId)))
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(
      <DashboardCommandControls
        actions={actionCatalogue()}
        onExecute={onExecute}
        voice={{ connected: false, connect, disconnect, transitioning: false }}
      />
    )
  })

  await act(async () => renderer.root.findByProps({ 'aria-label': 'Connect Copilot voice' }).props.onClick())
  expect(connect).toHaveBeenCalledOnce()

  await act(async () => renderer.root.findByProps({ 'aria-label': 'Toggle GalNet Radio playback' }).props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Target next route system' }).props.onClick())
  expect(onExecute).toHaveBeenNthCalledWith(1, 'elite.GalnetAudio_Play_Pause')
  expect(onExecute).toHaveBeenNthCalledWith(2, 'elite.TargetNextRouteSystem')

  const dock = renderer.root.findByProps({ 'aria-label': 'Request docking unavailable' })
  expect(dock.props.disabled).toBe(true)
  expect(dock.props.onClick).toBeUndefined()

  await act(async () => renderer.unmount())
})

function actionCatalogue(): GameActionCatalogResponse {
  return {
    actions: [
      availableAction('elite.GalnetAudio_Play_Pause', 'GalNet Audio play/pause'),
      availableAction('elite.TargetNextRouteSystem', 'Target next route system')
    ],
    backend: { available: true, detail: 'Ready', id: 'test', simulated: true },
    bindingSource: {
      available: true,
      bindingCount: 2,
      directory: null,
      error: null,
      filePath: null,
      keyboardBindingCount: 2,
      loadedAt: null,
      presetNames: ['Test']
    }
  }
}

function availableAction(id: string, label: string): GameActionCatalogResponse['actions'][number] {
  return {
    available: true,
    binding: { display: 'T', key: 'T', modifiers: [] },
    definition: {
      category: id.includes('Galnet') ? 'radio' : 'navigation',
      description: label,
      eliteBinding: id.replace('elite.', ''),
      id,
      inputMode: 'tap',
      label,
      risk: 'routine',
      telemetryKey: null
    },
    unavailableReason: null
  }
}

function result(actionId: string): GameActionResult {
  return {
    actionId,
    correlationId: 'correlation-id',
    message: 'Accepted.',
    operation: 'tap',
    origin: 'ui',
    requestId: 'request-id',
    status: 'accepted',
    timestamp: '2026-09-14T12:00:00.000Z'
  }
}
