import { useEffect } from 'react'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import type { NumpadRuntime } from './numpad-runtime.js'

export function NumpadActivation({ devicePreferences, runtime }: { devicePreferences: DevicePreferences, runtime: NumpadRuntime }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const activate = (event: KeyboardEvent) => {
      if (editable(event.target)) return
      if (runtime.keyDown(event, devicePreferences.getSnapshot().captureNumpad)) event.preventDefault()
    }
    const release = (event: KeyboardEvent) => runtime.controller.keyUp(event.code)
    const blur = () => runtime.controller.reset()
    window.addEventListener('keydown', activate)
    window.addEventListener('keyup', release)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', activate)
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', blur)
    }
  }, [devicePreferences, runtime])
  return null
}

function editable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}
