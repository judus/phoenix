import type { HealthResponse } from '@phoenix/contracts'
import type { ReactNode } from 'react'
import { AppHeader, AppShell } from './app-shell.js'
import {
  PrimaryNavigation,
  SecondaryNavigation,
  type NavigationItem
} from '../navigation/navigation.js'
import { AppBrand, TopBar } from '../top-bar/top-bar.js'

const primaryNavigation: NavigationItem[] = [
  { href: '#navigation', id: 'navigation', label: 'Navigation' },
  { href: '#ship', id: 'ship', label: 'Ship' },
  { href: '#engineering', id: 'engineering', label: 'Engineering' },
  { href: '#exploration', id: 'exploration', label: 'Exploration' },
  { href: '#/controls/ship', id: 'controls', label: 'Controls' },
  { href: '#copilot', id: 'copilot', label: 'Copilot' },
  { href: '#log', id: 'log', label: 'Log' }
]

export interface PhoenixShellProps {
  activePrimaryItemId?: string
  activeSecondaryItemId?: string
  children: ReactNode
  developerSection?: boolean
  error?: string
  health?: HealthResponse
  secondaryNavigation: NavigationItem[]
}

export function PhoenixShell ({
  activePrimaryItemId,
  activeSecondaryItemId,
  children,
  developerSection = false,
  error,
  health,
  secondaryNavigation
}: PhoenixShellProps) {
  const coreState = health ? 'Core online' : error ? 'Core unavailable' : 'Establishing link…'

  return (
    <AppShell
      header={(
        <AppHeader
          topBar={(
            <TopBar
              brand={<a href="#/"><AppBrand name="PHOENIX" qualifier="Terminal" /></a>}
              status={(
                <div className="core-status" aria-live="polite">
                  <span className="core-status__label">{coreState}</span>
                  <span className="core-status__detail">
                    {health ? `${health.database.engine} · API v${health.apiVersion}` : error}
                  </span>
                </div>
              )}
              actions={(
                <div className="top-bar-actions" aria-label="Application actions">
                  <button type="button" aria-label="Messages">▤</button>
                  <button type="button" aria-label="Settings">☷</button>
                  <a
                    href="#/developer/overview"
                    aria-current={developerSection ? 'page' : undefined}
                    aria-label="Developer tools"
                    title="Developer tools"
                  >DEV</a>
                  <button type="button" aria-label="Fullscreen">⛶</button>
                </div>
              )}
            />
          )}
          navigation={<PrimaryNavigation activeItemId={activePrimaryItemId} items={primaryNavigation} />}
        />
      )}
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
