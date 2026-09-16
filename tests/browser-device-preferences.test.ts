import { expect, test } from 'vitest'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

test('browser device preferences default to following Copilot and capturing the numpad', () => {
  const storage = new MemoryStorage()
  const preferences = new BrowserDevicePreferences(storage)

  expect(preferences.getSnapshot()).toEqual({
    version: 2,
    audioInputId: '',
    audioOutputId: '',
    captureNumpad: true,
    currentShipLoadoutView: 'tiles',
    followCopilotNavigation: true,
    presentation: 'phoenix',
    shipCatalogueView: 'dossier',
    uiScalePercent: 100,
    variableCommandLabelSizes: true
  })
  preferences.update({ variableCommandLabelSizes: false, audioInputId: 'mic-1', captureNumpad: false, currentShipLoadoutView: 'table', presentation: 'elite', shipCatalogueView: 'table', uiScalePercent: 115 })
  expect(new BrowserDevicePreferences(storage).getSnapshot()).toMatchObject({
    audioInputId: 'mic-1',
    captureNumpad: false,
    currentShipLoadoutView: 'table',
    presentation: 'elite',
    shipCatalogueView: 'table',
    uiScalePercent: 115,
    variableCommandLabelSizes: false
  })
})

test('browser device preferences migrate the Numpy-only label setting', () => {
  const storage = new MemoryStorage()
  storage.setItem('phoenix.device.preferences', JSON.stringify({
    version: 1,
    adaptiveNumpadLabels: false,
    audioInputId: '',
    audioOutputId: '',
    captureNumpad: true,
    currentShipLoadoutView: 'tiles',
    followCopilotNavigation: true,
    presentation: 'phoenix',
    shipCatalogueView: 'dossier',
    uiScalePercent: 100
  }))

  expect(new BrowserDevicePreferences(storage).getSnapshot()).toMatchObject({
    version: 2,
    variableCommandLabelSizes: false
  })
})

test('browser device preferences reject unversioned legacy data', () => {
  const storage = new MemoryStorage()
  storage.setItem('phoenix.device.allow-remote-display-commands', 'false')
  storage.setItem('phoenix.device.preferences', JSON.stringify({ followCopilotNavigation: false }))
  expect(new BrowserDevicePreferences(storage).getSnapshot().followCopilotNavigation).toBe(true)
})

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}
