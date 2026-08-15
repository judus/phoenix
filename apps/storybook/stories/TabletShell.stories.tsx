import { useRef, useState, type CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Deskplane } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'
import 'deskplane/style.css'

import { Button } from '../src/components/button'
import { AutoGrid, Stack } from '../src/components/layout'
import { PageFrame, PageHeader, Panel, Section } from '../src/components/page'
import {
  ApplicationShell,
  BottomBar,
  Content,
  Navigation,
  PrimaryBar,
  Rail,
  TopBar,
  Workspace
} from '../src/components/application-shell'
import type { NavigationItem } from '../src/components/app-shell'
import '../src/styles/tablet-shell-stories.css'
import phoenixMarkUrl from '../../web/public/phoenix.svg?url'

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

const workspaceItems: NavigationItem[] = [
  { id: 'controls', label: 'Controls', href: '#controls' },
  { id: 'info', label: 'Info', href: '#info' },
  { id: 'copilot', label: 'Copilot', href: '#copilot' }
]

function Brand() {
  const markStyle = {
    '--tablet-brand-mark-image': `url("${phoenixMarkUrl}")`
  } as CSSProperties

  return (
    <div className="tablet-brand">
      <span className="tablet-brand__mark" style={markStyle} aria-hidden="true" />
      <span className="tablet-brand__text">
        <strong className="tablet-brand__name">PHOENIX</strong>
        <span className="tablet-brand__context">Terminal</span>
      </span>
    </div>
  )
}

function CommanderContent() {
  return (
    <PageFrame>
      <Stack gap="xxl">
        <PageHeader
          context="Commander"
          title="Ellan Murdock"
          description="Docked at Locke Terminal · Col 285 Sector OK-C B14-5"
          metadata="616,187,357 CR"
          actions={<Button variant="primary">Open galaxy</Button>}
        />
        <Section title="Situation">
          <AutoGrid minimum="sm" gap="sm">
            <Panel title="Current ship">
              <div className="tablet-content__metric"><strong>Type-11 Prospector</strong><span>Hull 100% · Cargo 3 / 196</span></div>
            </Panel>
            <Panel title="Jump range">
              <div className="tablet-content__metric"><strong>22.4 ly</strong><span>Laden configuration</span></div>
            </Panel>
            <Panel title="Route">
              <div className="tablet-content__metric"><strong>No route plotted</strong><span>Navigation computer idle</span></div>
            </Panel>
          </AutoGrid>
        </Section>
        <Section divider title="Recent activity">
          <ul className="tablet-content__activity">
            <li><time>12:52 AM</time><strong>Mission completed</strong><span>Journal</span></li>
            <li><time>12:50 AM</time><strong>Mission accepted</strong><span>Journal</span></li>
            <li><time>12:49 AM</time><strong>Action executed</strong><span>Runtime</span></li>
            <li><time>12:45 AM</time><strong>Inventory cargo changed</strong><span>Journal</span></li>
          </ul>
        </Section>
      </Stack>
    </PageFrame>
  )
}

function BaselineShell() {
  return (
    <ApplicationShell>
      <TopBar
        brand={<Brand />}
        utilities={<Navigation variant="compact" label="Utilities" items={utilityItems} />}
      />
      <PrimaryBar launcher={<a href="#home" aria-label="Home">⌂</a>}>
        <Navigation label="Primary" current="fleet" items={primaryItems} />
      </PrimaryBar>
      <Workspace>
        <Rail label="Commander views">
          <Navigation
            variant="compact"
            selection="subtle"
            label="Commander views"
            current="ship"
            items={contextItems}
          />
        </Rail>
        <Content><CommanderContent /></Content>
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

function FullBaseline() {
  return <div className="tablet-shell-story"><BaselineShell /></div>
}

function DeskplanePage({ children }: { children: React.ReactNode }) {
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
      <DeskplanePage><CommanderContent /></DeskplanePage>
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
          className="application-shell__body"
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
  component: FullBaseline,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FullBaseline>

export default meta
type Story = StoryObj<typeof meta>

export const ResponsiveCanvas: Story = {}
export const DeskplaneWorkspaces: Story = { render: () => <DeskplaneShell /> }
