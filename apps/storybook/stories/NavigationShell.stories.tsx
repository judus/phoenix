import type { Meta, StoryObj } from '@storybook/react-vite'

import { AppNavigation, AppShell, type NavigationItem } from '../src/components/app-shell'
import { Button } from '../src/components/button'
import { AutoGrid, Stack } from '../src/components/layout'
import { PageFrame, PageHeader, Panel, Section } from '../src/components/page'
import { Status } from '../src/components/status'
import '../src/styles/shell-stories.css'

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
      <strong className="shell-brand__name">PHOENIX</strong>
      <span className="shell-brand__context">Pilot operations</span>
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
              <div className="shell-story__metric">
                <strong className="shell-story__metric-value">86%</strong>
                <span className="shell-story__metric-detail">Main tank · 27.5 t remaining</span>
              </div>
            </Panel>
            <Panel title="Jump range">
              <div className="shell-story__metric">
                <strong className="shell-story__metric-value">31.4 ly</strong>
                <span className="shell-story__metric-detail">Laden configuration</span>
              </div>
            </Panel>
            <Panel title="Cargo">
              <div className="shell-story__metric">
                <strong className="shell-story__metric-value">42 / 128 t</strong>
                <span className="shell-story__metric-detail">Basic medicines</span>
              </div>
            </Panel>
          </AutoGrid>
        </Section>
        <Section divider title="Recent activity">
          <ul className="shell-story__activity">
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
    <div className="shell-story shell-story--bounded">
      <div className="shell-story__deskplane">
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
