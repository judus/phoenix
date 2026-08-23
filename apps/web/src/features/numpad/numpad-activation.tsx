import { useEffect, useSyncExternalStore } from 'react'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import type { NumpadRouteSession } from '../../application/navigation/numpad-route-session.js'
import type { PhoenixRouter } from '../../application/navigation/phoenix-router.js'

export function NumpadActivation({ devicePreferences, routeSession, router }: { devicePreferences: DevicePreferences, routeSession: NumpadRouteSession, router: PhoenixRouter }) {
  const preferences = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.getSnapshot, devicePreferences.getSnapshot)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const activate = (event: KeyboardEvent) => {
      if (!preferences.captureNumpad || event.code !== 'Numpad0' || editable(event.target) || router.getSnapshot().kind === 'numpad') return
      event.preventDefault()
      routeSession.arm()
      router.push({ kind: 'numpad' })
    }
    window.addEventListener('keydown', activate)
    return () => window.removeEventListener('keydown', activate)
  }, [preferences.captureNumpad, routeSession, router])
  return null
}

function editable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}
