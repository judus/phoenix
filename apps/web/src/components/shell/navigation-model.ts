import type { NavigationItem } from '@phoenix/ui'

export const utilityItems: NavigationItem[] = [
  { id: 'telemetry', label: 'Telemetry', shortLabel: '123', href: '#telemetry' },
  { id: 'macros', label: 'Macros', shortLabel: 'MAC', href: '#macros' },
  { id: 'journal', label: 'Journal log', shortLabel: 'LOG', href: '#journal' },
  { id: 'developer', label: 'Developer tools', shortLabel: 'DEV', href: '#developer' },
  { id: 'settings', label: 'Settings', shortLabel: '⚙', href: '#settings' },
  { id: 'fullscreen', label: 'Fullscreen', shortLabel: '⛶', href: '#fullscreen' }
]

export const primaryItems: NavigationItem[] = [
  { id: 'commander', label: 'Commander', href: '#commander' },
  { id: 'fleet', label: 'Fleet', href: '#fleet' },
  { id: 'galaxy', label: 'Galaxy', href: '#galaxy' },
  { id: 'operations', label: 'Operations', href: '#operations' },
  { id: 'engineering', label: 'Engineering', href: '#engineering' },
  { id: 'comms', label: 'Comms', href: '#comms' }
]

export const contextItems: NavigationItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: '◇', href: '#overview' },
  { id: 'ship', label: 'Current ship', shortLabel: 'SHP', href: '#ship' },
  { id: 'alerts', label: 'Alerts', shortLabel: 'ALT', href: '#alerts', badge: '2' }
]

export const workspaceItems: NavigationItem[] = [
  { id: 'controls', label: 'Controls', href: '#controls' },
  { id: 'info', label: 'Info', href: '#info' },
  { id: 'copilot', label: 'Copilot', href: '#copilot' }
]
