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
  secondaryNavigation: NavigationItem[]
}

export function PhoenixShell ({
  activePrimaryItemId,
  activeSecondaryItemId,
  children,
  secondaryNavigation
}: PhoenixShellProps) {
  const informationNavigation = activePrimaryItemId !== 'controls' && activePrimaryItemId !== 'copilot'

  return (
    <AppShell
      header={informationNavigation ? (
        <AppHeader
          navigation={<PrimaryNavigation activeItemId={activePrimaryItemId} items={primaryNavigation} />}
        />
      ) : undefined}
      secondaryNavigation={(
        <SecondaryNavigation
          activeItemId={activeSecondaryItemId}
          items={secondaryNavigation}
        />
      )}
    >
      {children}
    </AppShell>
  )
}

export function PhoenixTopBar ({
  developerSection = false,
  recordsSection = false
}: {
  developerSection?: boolean
  recordsSection?: boolean
}) {
  return (
    <TopBar
      brand={<a href="#/"><AppBrand name="PHOENIX" qualifier="Terminal" /></a>}
      actions={(
        <div className="top-bar-actions" aria-label="Application actions">
          <a
            href="#/records/journal"
            aria-current={recordsSection ? 'page' : undefined}
            aria-label="Records"
            title="Records"
          >▤</a>
          <button type="button" aria-label="Settings">☷</button>
          <a
            href="#/developer/overview"
            aria-current={developerSection ? 'page' : undefined}
            aria-label="Developer tools"
            title="Developer tools"
          >DEV</a>
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
