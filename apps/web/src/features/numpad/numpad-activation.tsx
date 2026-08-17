import { useEffect, useSyncExternalStore } from 'react'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import type { PhoenixRouter } from '../../application/navigation/phoenix-router.js'
import { armNumpadRoute } from './numpad-route-session.js'

export function NumpadActivation({ devicePreferences, router }: { devicePreferences: DevicePreferences, router: PhoenixRouter }) {
  const preferences = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.getSnapshot, devicePreferences.getSnapshot)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const activate = (event: KeyboardEvent) => {
      if (!preferences.captureNumpad || event.code !== 'Numpad0' || editable(event.target) || router.getSnapshot().kind === 'numpad') return
      event.preventDefault()
      armNumpadRoute(window.location.hash)
      router.push({ kind: 'numpad', view: 'navigator' })
    }
    window.addEventListener('keydown', activate)
    return () => window.removeEventListener('keydown', activate)
  }, [preferences.captureNumpad, router])
  return null
}

function editable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}
