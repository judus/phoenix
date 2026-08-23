import { expect, test } from 'vitest'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

test('browser device preferences default to following Copilot and capturing the numpad', () => {
  const storage = new MemoryStorage()
  const preferences = new BrowserDevicePreferences(storage)

  expect(preferences.getSnapshot()).toEqual({
    audioInputId: '',
    audioOutputId: '',
    captureNumpad: true,
    followCopilotNavigation: true,
    variableNumpadFontSizes: true
  })
  preferences.update({ audioInputId: 'mic-1', captureNumpad: false, variableNumpadFontSizes: false })
  expect(new BrowserDevicePreferences(storage).getSnapshot()).toMatchObject({
    audioInputId: 'mic-1',
    captureNumpad: false,
    variableNumpadFontSizes: false
  })
})

test('browser device preferences migrate the previous display-following choice', () => {
  const storage = new MemoryStorage()
  storage.setItem('phoenix.device.allow-remote-display-commands', 'false')
  expect(new BrowserDevicePreferences(storage).getSnapshot().followCopilotNavigation).toBe(false)
})

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}
