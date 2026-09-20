import { DOMParser } from '@xmldom/xmldom'
import type { EliteDangerousBindingSource } from 'control-deck/integration-elite-dangerous'

// Galaxy Map digital camera controls only; FreeCam controls are unrelated.
const CAMERA_BINDINGS = new Set([
  'CamPitchUp', 'CamPitchDown', 'CamYawLeft', 'CamYawRight',
  'CamTranslateForward', 'CamTranslateBackward', 'CamTranslateLeft', 'CamTranslateRight',
  'CamTranslateUp', 'CamTranslateDown', 'CamZoomIn', 'CamZoomOut', 'CamTranslateZHold'
])
const AUTOMATED_UI_BINDINGS = ['UI_Up', 'UI_Right', 'UI_Select'] as const

export function galaxyMapBindingWarnings(xml: string, source: Pick<EliteDangerousBindingSource, 'resolve'>): string[] {
  const document = new DOMParser({
    onError: (_level, message) => { throw new Error(message) }
  }).parseFromString(xml, 'application/xml')
  if (document.documentElement?.tagName !== 'Root') throw new Error('Invalid Elite bindings file.')

  const warnings = new Set<string>()
  for (const action of AUTOMATED_UI_BINDINGS) {
    const uiBinding = source.resolve(action)
    if (!uiBinding) continue
    const uiChord = chord(uiBinding.key, uiBinding.modifiers)
    for (const camera of Array.from(document.documentElement.children)) {
      if (!CAMERA_BINDINGS.has(camera.tagName)) continue
      // The resolver chooses one keyboard binding. Both camera slots can react
      // to that key, so diagnostics must inspect primary AND secondary slots.
      for (const slot of Array.from(camera.children)) {
        if (!['Primary', 'Secondary'].includes(slot.tagName) || slot.getAttribute('Device') !== 'Keyboard') continue
        const key = keyboardKey(slot.getAttribute('Key'))
        const modifiers = Array.from(slot.children).filter(child => child.tagName === 'Modifier')
        if (!key || modifiers.some(modifier => modifier.getAttribute('Device') !== 'Keyboard')) continue
        const modifierKeys = modifiers.map(modifier => keyboardKey(modifier.getAttribute('Key')))
        if (modifierKeys.some(modifier => modifier === null)) continue
        if (uiChord === chord(key, modifierKeys as string[])) {
          warnings.add(`${action} (${uiBinding.display}) also activates Galaxy Map camera control ${camera.tagName}. Assign different keys in Elite.`)
        }
      }
    }
  }
  return [...warnings]
}

function keyboardKey(key: string | null): string | null {
  return key?.startsWith('Key_') ? key.slice(4) : null
}

function chord(key: string, modifiers: string[]): string {
  return JSON.stringify([key.toLowerCase(), [...new Set(modifiers.map(modifier => modifier.toLowerCase()))].sort()])
}
