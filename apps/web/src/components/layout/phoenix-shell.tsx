import type { HealthResponse } from '@phoenix/contracts'
import { useEffect, useState, type ReactNode } from 'react'
import { AppHeader, AppShell } from './app-shell.js'
import {
  PrimaryNavigation,
  SecondaryNavigation,
  type NavigationItem
} from '../navigation/navigation.js'
import { AppBrand, TopBar } from '../top-bar/top-bar.js'

const primaryNavigation: NavigationItem[] = [
  { href: '#/', icon: '⌂', iconOnly: true, id: 'home', label: 'Home' },
  { href: '#/commander/overview', id: 'commander', label: 'Commander' },
  { href: '#/fleet/overview', id: 'fleet', label: 'Fleet' },
  { href: '#/galaxy/system', id: 'galaxy', label: 'Galaxy' },
  { href: '#/operations/overview', id: 'operations', label: 'Operations' },
  { href: '#/engineering/blueprints', id: 'engineering', label: 'Engineering' },
  { href: '#/comms/overview', id: 'comms', label: 'Comms' }
]

export interface PhoenixShellProps {
  activePrimaryItemId?: string
  activeSecondaryItemId?: string
  children: ReactNode
  error?: string
  health?: HealthResponse
  showPrimaryNavigation?: boolean
  secondaryNavigation: NavigationItem[]
}

export function PhoenixShell ({
  activePrimaryItemId,
  activeSecondaryItemId,
  children,
  showPrimaryNavigation = true,
  secondaryNavigation
}: PhoenixShellProps) {
  const informationNavigation = showPrimaryNavigation && activePrimaryItemId !== 'controls' && activePrimaryItemId !== 'copilot'

  return (
    <AppShell
      header={informationNavigation ? (
        <AppHeader
          navigation={<PrimaryNavigation activeItemId={activePrimaryItemId} items={primaryNavigation} />}
        />
      ) : undefined}
      secondaryNavigation={secondaryNavigation.length > 0 ? (
        <SecondaryNavigation
          activeItemId={activeSecondaryItemId}
          items={secondaryNavigation}
        />
      ) : undefined}
    >
      {children}
    </AppShell>
  )
}

export function PhoenixTopBar ({
  developerSection = false,
  macroSection = false,
  numpadSection = false,
  recordsSection = false,
  settingsSection = false
}: {
  developerSection?: boolean
  macroSection?: boolean
  numpadSection?: boolean
  recordsSection?: boolean
  settingsSection?: boolean
}) {
  return (
    <TopBar
      brand={<a href="#/"><AppBrand name="PHOENIX" qualifier="Terminal" /></a>}
      actions={(
        <div className="top-bar-actions" aria-label="Application actions">
          <a
            href="#/numpad"
            aria-current={numpadSection ? 'page' : undefined}
            aria-label="Numpad command navigator"
            title="Numpad command navigator"
          >123</a>
          <a
            href="#/macros"
            aria-current={macroSection ? 'page' : undefined}
            aria-label="Macros"
            title="Macros"
          >MAC</a>
          <a
            href="#/records/journal"
            aria-current={recordsSection ? 'page' : undefined}
            aria-label="Records"
            title="Records"
          >LOG</a>
          <a
            href="#/developer/overview"
            aria-current={developerSection ? 'page' : undefined}
            aria-label="Developer tools"
            title="Developer tools"
          >DEV</a>
          <a
            href="#/settings/system"
            aria-current={settingsSection ? 'page' : undefined}
            aria-label="Settings"
            title="Settings"
          >⚙</a>
          <FullscreenButton />
        </div>
      )}
    />
  )
}

function FullscreenButton () {
  const [active, setActive] = useState(false)
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled

  useEffect(() => {
    const synchronize = (): void => setActive(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', synchronize)
    synchronize()
    return () => document.removeEventListener('fullscreenchange', synchronize)
  }, [])

  const toggle = async (): Promise<void> => {
    if (!supported) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  }

  return (
    <button
      type="button"
      aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-pressed={active}
      disabled={!supported}
      onClick={() => void toggle()}
      title={active ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      {active ? '⛶' : '⛶'}
    </button>
  )
}
