import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { DevicePreferences } from '../application/settings/device-preferences.js'

const ROOT_SCALE_PROPERTIES = [
  '--ui-font-min',
  '--ui-font-large-min',
  '--ui-font-fluid-vw',
  '--ui-font-fluid-vmin',
  '--ui-font-max'
] as const

export function DevicePresentation ({
  children,
  preferences
}: {
  children: ReactNode
  preferences: DevicePreferences
}) {
  const snapshot = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot, preferences.getSnapshot)

  useLayoutEffect(() => {
    const root = globalThis.document?.documentElement
    if (!root) return
    const scale = snapshot.uiScalePercent / 100
    const values = [
      `${15 * scale}px`,
      `${18 * scale}px`,
      `${1.125 * scale}vw`,
      `${2 * scale}vmin`,
      `${28 * scale}px`
    ]
    ROOT_SCALE_PROPERTIES.forEach((property, index) => root.style.setProperty(property, values[index]!))
    return () => ROOT_SCALE_PROPERTIES.forEach(property => root.style.removeProperty(property))
  }, [snapshot.uiScalePercent])

  return (
    <div className={snapshot.presentation === 'elite' ? 'phoenix-presentation theme-elite' : 'phoenix-presentation'}>
      {children}
    </div>
  )
}
