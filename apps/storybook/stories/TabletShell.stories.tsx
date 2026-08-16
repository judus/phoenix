import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Deskplane } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'
import 'deskplane/style.css'

import { PageFrame, PageHeader } from '@phoenix/ui'
import {
  ApplicationShell,
  BottomBar,
  Content,
  Navigation,
  PrimaryBar,
  Rail,
  TopBar,
  Workspace
} from '@phoenix/ui'
import type { NavigationItem } from '@phoenix/ui'
import { CurrentShipConsolidatedPage } from '../src/pages/current-ship-consolidated-page'
import { CurrentShipLoadoutPage } from '../src/pages/current-ship-loadout-page'
import { FleetPage } from '../src/pages/fleet-page'
import { FilteredSystemSearchPage } from '../src/pages/filtered-system-search-page'
import { GalnetPage } from '../src/pages/galnet-page'
import { GalnetRadioPage } from '../src/pages/galnet-radio-page'
import { HomeDashboardPage } from '../src/pages/home-dashboard-page'
import { PersonalStoresPage } from '../src/pages/personal-stores-page'
import { PlottedRoutePage } from '../src/pages/plotted-route-page'
import { QueryConsolePage } from '../src/pages/query-console-page'
import { ShipCataloguePage } from '../src/pages/ship-catalogue-page'
import { StoredModulesPage } from '../src/pages/stored-modules-page'
import { TrafficPage } from '../src/pages/traffic-page'
import '../src/styles/tablet-shell-stories.css'

const utilityItems: NavigationItem[] = [
  { id: 'telemetry', label: 'Telemetry', shortLabel: '123', href: '#telemetry' },
  { id: 'macros', label: 'Macros', shortLabel: 'MAC', href: '#macros' },
  { id: 'journal', label: 'Journal log', shortLabel: 'LOG', href: '#journal' },
  { id: 'developer', label: 'Developer tools', shortLabel: 'DEV', href: '#developer' },
  { id: 'settings', label: 'Settings', shortLabel: '⚙', href: '#settings' },
  { id: 'fullscreen', label: 'Fullscreen', shortLabel: '⛶', href: '#fullscreen' }
]

const primaryItems: NavigationItem[] = [
  { id: 'commander', label: 'Commander', href: '#commander' },
  { id: 'fleet', label: 'Fleet', href: '#fleet' },
  { id: 'galaxy', label: 'Galaxy', href: '#galaxy' },
  { id: 'operations', label: 'Operations', href: '#operations' },
  { id: 'engineering', label: 'Engineering', href: '#engineering' },
  { id: 'comms', label: 'Comms', href: '#comms' }
]

const contextItems: NavigationItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: '◇', href: '#overview' },
  { id: 'ship', label: 'Current ship', shortLabel: 'SHP', href: '#ship' },
  { id: 'alerts', label: 'Alerts', shortLabel: 'ALT', href: '#alerts', badge: '2' }
]

const commsItems: NavigationItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: '◇', href: '#comms-overview' },
  { id: 'inbox', label: 'Inbox', shortLabel: '▤', href: '#inbox' },
  { id: 'traffic', label: 'Traffic', shortLabel: '⌁', href: '#traffic' },
  { id: 'contacts', label: 'Contacts', shortLabel: '◎', href: '#contacts' },
  { id: 'galnet', label: 'GalNet', shortLabel: 'N', href: '#galnet' },
  { id: 'radio', label: 'Radio', shortLabel: 'RAD', href: '#radio' }
]

const workspaceItems: NavigationItem[] = [
  { id: 'controls', label: 'Controls', href: '#controls' },
  { id: 'info', label: 'Info', href: '#info' },
  { id: 'copilot', label: 'Copilot', href: '#copilot' }
]

function Brand() {
  return (
    <div className="product-brand">
      <i aria-hidden="true" />
      <span>
        <strong>PHOENIX</strong>
        <small>Terminal</small>
      </span>
    </div>
  )
}

function BaselineShell({
  children,
  context = 'ship',
  primary = 'fleet',
  railItems = contextItems,
  railLabel = 'Section views'
}: {
  children?: React.ReactNode
  context?: string
  primary?: string
  railItems?: NavigationItem[]
  railLabel?: string
}) {
  return (
    <ApplicationShell>
      <TopBar
        brand={<Brand />}
        utilities={<Navigation variant="compact" label="Utilities" items={utilityItems} />}
      />
      <PrimaryBar launcher={<a href="#home" aria-label="Home">⌂</a>}>
        <Navigation label="Primary" current={primary} items={primaryItems} />
      </PrimaryBar>
      <Workspace>
        <Rail label={railLabel}>
          <Navigation
            variant="compact"
            selection="subtle"
            label={railLabel}
            current={context}
            items={railItems}
          />
        </Rail>
        <Content>{children}</Content>
      </Workspace>
      <BottomBar>
        <Navigation
          variant="workspace"
          selection="subtle"
          label="Workspaces"
          current="info"
          items={workspaceItems}
        />
      </BottomBar>
    </ApplicationShell>
  )
}

function CurrentShipShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell>
        <CurrentShipConsolidatedPage actionStyle="tile" meterLayout="inline" />
      </BaselineShell>
    </div>
  )
}

function HomeDashboardShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview">
        <HomeDashboardPage />
      </BaselineShell>
    </div>
  )
}

function CurrentLoadoutShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell>
        <CurrentShipLoadoutPage />
      </BaselineShell>
    </div>
  )
}

function FleetShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview">
        <FleetPage />
      </BaselineShell>
    </div>
  )
}

function ShipCatalogueShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview">
        <ShipCataloguePage />
      </BaselineShell>
    </div>
  )
}

function StoredModulesShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview">
        <StoredModulesPage />
      </BaselineShell>
    </div>
  )
}

function PersonalStoresShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview" primary="commander">
        <PersonalStoresPage />
      </BaselineShell>
    </div>
  )
}

function PlottedRouteShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview" primary="galaxy">
        <PlottedRoutePage />
      </BaselineShell>
    </div>
  )
}

function QueryConsoleShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview" primary="galaxy">
        <QueryConsolePage />
      </BaselineShell>
    </div>
  )
}

function FilteredSystemSearchShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell context="overview" primary="galaxy">
        <FilteredSystemSearchPage />
      </BaselineShell>
    </div>
  )
}

function TrafficShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell
        context="traffic"
        primary="comms"
        railItems={commsItems}
        railLabel="Comms views"
      >
        <TrafficPage />
      </BaselineShell>
    </div>
  )
}

function GalnetShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell
        context="galnet"
        primary="comms"
        railItems={commsItems}
        railLabel="Comms views"
      >
        <GalnetPage />
      </BaselineShell>
    </div>
  )
}

function GalnetRadioShell() {
  return (
    <div className="tablet-shell-story">
      <BaselineShell
        context="radio"
        primary="comms"
        railItems={commsItems}
        railLabel="Comms views"
      >
        <GalnetRadioPage />
      </BaselineShell>
    </div>
  )
}

function DeskplanePage({ children }: { children?: React.ReactNode }) {
  return (
    <div className="tablet-deskplane-page">
      <Rail label="Commander views">
        <Navigation
          variant="compact"
          selection="subtle"
          label="Commander views"
          current="ship"
          items={contextItems}
        />
      </Rail>
      <Content>{children}</Content>
    </div>
  )
}

function UtilityPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="tablet-deskplane-page">
      <Content>{children}</Content>
    </div>
  )
}

function InformationDesktop() {
  return (
    <div className="tablet-deskplane-section">
      <PrimaryBar launcher={<a href="#home" aria-label="Home">⌂</a>}>
        <Navigation label="Primary" current="fleet" items={primaryItems} />
      </PrimaryBar>
      <DeskplanePage />
    </div>
  )
}

function SimplePage({ context, description, title }: { context: string; description: string; title: string }) {
  return (
    <PageFrame>
      <PageHeader context={context} title={title} description={description} />
    </PageFrame>
  )
}

function DeskplaneShell() {
  const controller = useRef<Deskplane | null>(null)
  const [current, setCurrent] = useState('info')

  return (
    <div className="tablet-shell-story">
      <ApplicationShell>
        <TopBar
          brand={<Brand />}
          utilities={
            <Navigation
              variant="compact"
              label="Utilities"
              current={current}
              items={utilityItems}
              onItemSelect={(item) => {
                if (item.id !== 'fullscreen') void controller.current?.goTo(item.id)
              }}
            />
          }
        />
        <DeskplaneViewport
          aria-label="Application workspaces"
          className="shell-body"
          initialDesktopId="info"
          onReady={(deskplane) => {
            controller.current = deskplane
            return () => {
              if (controller.current === deskplane) controller.current = null
            }
          }}
          onSnapshotChange={(snapshot) => setCurrent(snapshot.activeDesktopId)}
          rows={[
            {
              id: 'utilities',
              initialDesktopId: 'telemetry',
              desktops: [
                {
                  id: 'telemetry',
                  ariaLabel: 'Telemetry workspace',
                  children: <UtilityPage><SimplePage context="Telemetry" title="Numpad" description="Telemetry and direct-entry controls" /></UtilityPage>
                },
                {
                  id: 'macros',
                  ariaLabel: 'Macros workspace',
                  children: <UtilityPage><SimplePage context="Macros" title="Command macros" description="Stored command sequences" /></UtilityPage>
                },
                {
                  id: 'journal',
                  ariaLabel: 'Journal workspace',
                  children: <UtilityPage><SimplePage context="Journal" title="Event log" description="Recent game and application events" /></UtilityPage>
                }
              ]
            },
            {
              id: 'workspaces',
              initialDesktopId: 'info',
              desktops: [
                {
                  id: 'controls',
                  ariaLabel: 'Controls workspace',
                  children: <DeskplanePage><SimplePage context="Controls" title="Flight controls" description="Ship and game command surfaces" /></DeskplanePage>
                },
                {
                  id: 'info',
                  ariaLabel: 'Information workspace',
                  children: <InformationDesktop />
                },
                {
                  id: 'copilot',
                  ariaLabel: 'Copilot workspace',
                  children: <DeskplanePage><SimplePage context="Copilot" title="Flight assistant" description="Conversation and current task context" /></DeskplanePage>
                }
              ]
            },
            {
              id: 'system',
              initialDesktopId: 'developer',
              desktops: [
                {
                  id: 'developer',
                  ariaLabel: 'Developer workspace',
                  children: <UtilityPage><SimplePage context="Developer" title="Developer tools" description="Runtime inspection and diagnostics" /></UtilityPage>
                },
                {
                  id: 'settings',
                  ariaLabel: 'Settings workspace',
                  children: <UtilityPage><SimplePage context="Settings" title="Application settings" description="Display, connection and control preferences" /></UtilityPage>
                }
              ]
            }
          ]}
        />
        <BottomBar>
          <Navigation
            variant="workspace"
            selection="subtle"
            label="Workspaces"
            current={current}
            items={workspaceItems}
            onItemSelect={(item) => void controller.current?.goTo(item.id)}
          />
        </BottomBar>
      </ApplicationShell>
    </div>
  )
}

const meta = {
  title: 'Shell/Tablet baseline',
  component: DeskplaneShell,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof DeskplaneShell>

export default meta
type Story = StoryObj<typeof meta>

export const DeskplaneWorkspaces: Story = {}
export const HomeDashboard: Story = { render: () => <HomeDashboardShell /> }
export const CurrentShip: Story = { render: () => <CurrentShipShell /> }
export const CurrentLoadout: Story = { render: () => <CurrentLoadoutShell /> }
export const Fleet: Story = { render: () => <FleetShell /> }
export const ShipCatalogue: Story = { render: () => <ShipCatalogueShell /> }
export const StoredModules: Story = { render: () => <StoredModulesShell /> }
export const PersonalStores: Story = { render: () => <PersonalStoresShell /> }
export const PlottedRoute: Story = { render: () => <PlottedRouteShell /> }
export const QueryConsole: Story = { render: () => <QueryConsoleShell /> }
export const FilteredSystemSearch: Story = { render: () => <FilteredSystemSearchShell /> }
export const Traffic: Story = { render: () => <TrafficShell /> }
export const Galnet: Story = { render: () => <GalnetShell /> }
export const GalnetRadio: Story = { render: () => <GalnetRadioShell /> }
