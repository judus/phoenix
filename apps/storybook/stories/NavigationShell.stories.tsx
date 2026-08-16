import type { Meta, StoryObj } from '@storybook/react-vite'

import { AppNavigation, AppShell, type NavigationItem } from '@phoenix/ui'
import { Button } from '@phoenix/ui'
import { AutoGrid, Stack } from '@phoenix/ui'
import { Metric } from '@phoenix/ui'
import { PageFrame, PageHeader, Panel, Section } from '@phoenix/ui'
import { Status } from '@phoenix/ui'

const primaryItems: NavigationItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'OV', href: '#overview' },
  { id: 'fleet', label: 'Fleet', shortLabel: 'FL', href: '#fleet', badge: '3' },
  { id: 'galaxy', label: 'Galaxy', shortLabel: 'GX', href: '#galaxy' },
  { id: 'operations', label: 'Operations', shortLabel: 'OP', href: '#operations', badge: '2' },
  { id: 'engineering', label: 'Engineering', shortLabel: 'EN', href: '#engineering' },
  { id: 'comms', label: 'Comms', shortLabel: 'CM', href: '#comms' }
]

const secondaryItems: NavigationItem[] = [
  { id: 'controls', label: 'Controls', href: '#controls' },
  { id: 'info', label: 'Info', href: '#info' },
  { id: 'copilot', label: 'Copilot', href: '#copilot', badge: '1' }
]

function Brand() {
  return (
    <div className="shell-brand">
      <strong>PHOENIX</strong>
      <small>Pilot operations</small>
    </div>
  )
}

function Dashboard() {
  return (
    <PageFrame>
      <Stack gap="xxl">
        <PageHeader
          context="Commander Muirn"
          title="Ship overview"
          description="Nightjar · Krait Mk II · Col 285 Sector OK-C B14-5"
          actions={<Button variant="primary">Open ship</Button>}
        />
        <Section title="Current state">
          <AutoGrid minimum="sm" gap="sm">
            <Panel title="Fuel">
              <Metric value="86%" detail="Main tank · 27.5 t remaining" />
            </Panel>
            <Panel title="Jump range">
              <Metric value="31.4 ly" detail="Laden configuration" />
            </Panel>
            <Panel title="Cargo">
              <Metric value="42 / 128 t" detail="Basic medicines" />
            </Panel>
          </AutoGrid>
        </Section>
        <Section divider title="Recent activity">
          <ul className="activity-list">
            <li><strong>Route calculation completed</strong><span>2 min ago</span></li>
            <li><strong>Mission cargo loaded</strong><span>18 min ago</span></li>
            <li><strong>Ship data synchronized</strong><span>24 min ago</span></li>
          </ul>
        </Section>
      </Stack>
    </PageFrame>
  )
}

function Shell({ navigation }: { navigation: 'sidebar' | 'bands' }) {
  return (
    <AppShell
      navigation={navigation}
      brand={<Brand />}
      status={<Status tone="positive">Game connected</Status>}
      utilities={
        <>
          <Button size="sm" variant="quiet">Notifications</Button>
          <Button size="sm" variant="secondary">Settings</Button>
        </>
      }
      primaryNavigation={
        <AppNavigation label="Primary" current="overview" items={primaryItems} />
      }
      secondaryNavigation={
        <AppNavigation label="Workspace" slot="secondary" current="info" items={secondaryItems} />
      }
    >
      <Dashboard />
    </AppShell>
  )
}

function FullShell({ navigation }: { navigation: 'sidebar' | 'bands' }) {
  return <div className="shell-story"><Shell navigation={navigation} /></div>
}

function BoundedWorkspace() {
  return (
    <div className="shell-story bounded">
      <div className="deskplane-example">
        <Shell navigation="sidebar" />
      </div>
    </div>
  )
}

const meta = {
  title: 'Reminders/Website shell alternatives',
  component: FullShell,
  args: { navigation: 'sidebar' },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FullShell>

export default meta
type Story = StoryObj<typeof meta>

export const WorkspaceSidebar: Story = {
  render: () => <FullShell navigation="sidebar" />
}

export const CockpitBands: Story = {
  render: () => <FullShell navigation="bands" />
}

export const DeskplaneRegion: Story = {
  render: () => <BoundedWorkspace />
}
