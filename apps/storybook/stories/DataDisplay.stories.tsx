import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '../src/components/button'
import { DataTable } from '../src/components/data-table'
import { ItemList, ItemListItem } from '../src/components/item-list'
import { Stack } from '../src/components/layout'
import { PageFrame, PageHeader, Section } from '../src/components/page'
import { Status } from '../src/components/status'
import '../src/styles/data-display-stories.css'

function MissionList() {
  return (
    <ItemList aria-label="Active missions">
      <ItemListItem
        href="#mission-supply"
        selected
        leading={<span className="identifier">CG</span>}
        title="Supply medicines to HIP 97950"
        description="Deliver 42 tonnes of basic medicines before the operation closes."
        meta="Expires in 2 h 18 min"
        trailing={<Status tone="information">Tracked</Status>}
        actions={<Button size="sm" variant="quiet">Details</Button>}
      />
      <ItemListItem
        href="#mission-courier"
        leading={<span className="identifier">CR</span>}
        title="Courier data to Lave Station"
        description="Mission cargo is already aboard."
        meta="Reward 1,240,000 CR"
        trailing={<Status tone="positive">Ready</Status>}
      />
      <ItemListItem
        href="#mission-scan"
        leading={<span className="identifier">EX</span>}
        title="Scan the Colonia Bridge beacon"
        description="The target system has incomplete navigation data."
        meta="12 jumps from current position"
        trailing={<Status tone="warning">Caution</Status>}
      />
      <ItemListItem
        disabled
        leading={<span className="identifier">AX</span>}
        title="Threat response contract"
        description="Required combat loadout is not installed."
        meta="Unavailable for this ship"
        trailing={<Status tone="muted">Locked</Status>}
      />
    </ItemList>
  )
}

function FleetTable({ narrow = 'priority' }: { narrow?: 'priority' | 'scroll' }) {
  return (
    <DataTable label="Commander fleet" narrow={narrow} minimum="wide">
      <thead>
        <tr>
          <th scope="col">Ship</th>
          <th scope="col">Status</th>
          <th className="priority-secondary" scope="col">Role</th>
          <th className="priority-secondary" scope="col">Location</th>
          <th className="priority-tertiary numeric" scope="col">Range</th>
          <th className="priority-tertiary" scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        <tr className="active">
          <td><div className="entity-name"><strong>Nightjar</strong><small>Krait Mk II</small></div></td>
          <td><Status tone="positive">Active</Status></td>
          <td className="priority-secondary">Multipurpose</td>
          <td className="priority-secondary">Col 285 Sector OK-C B14-5</td>
          <td className="priority-tertiary numeric">31.4 ly</td>
          <td className="priority-tertiary">2 min ago</td>
        </tr>
        <tr>
          <td><div className="entity-name"><strong>Far Lantern</strong><small>Diamondback Explorer</small></div></td>
          <td><Status tone="information">Stored</Status></td>
          <td className="priority-secondary">Exploration</td>
          <td className="priority-secondary">Jameson Memorial</td>
          <td className="priority-tertiary numeric">67.8 ly</td>
          <td className="priority-tertiary">Yesterday</td>
        </tr>
        <tr>
          <td><div className="entity-name"><strong>Red Shift</strong><small>Fer-de-Lance</small></div></td>
          <td><Status tone="warning">Maintenance</Status></td>
          <td className="priority-secondary">Combat</td>
          <td className="priority-secondary">Ray Gateway</td>
          <td className="priority-tertiary numeric">18.2 ly</td>
          <td className="priority-tertiary">4 days ago</td>
        </tr>
      </tbody>
    </DataTable>
  )
}

function DataDisplayOverview() {
  return (
    <PageFrame>
      <Stack gap="xxl">
        <PageHeader
          context="Commander"
          title="Operational data"
          description="Lists and tables remain open, readable, and intentional under constrained width."
          actions={<Button variant="primary">Refresh data</Button>}
        />
        <Section
          title="Active missions"
          description="Rows use separators and state indicators without enclosing the entire list."
        >
          <MissionList />
        </Section>
        <Section
          divider
          title="Fleet"
          description="Optional columns disappear by declared priority; essential identity and state remain."
        >
          <FleetTable />
        </Section>
      </Stack>
    </PageFrame>
  )
}

function ScrollTable() {
  return (
    <PageFrame>
      <Stack gap="xl">
        <PageHeader
          variant="compact"
          context="Narrow strategy"
          title="Scrollable table"
          description="Use horizontal scrolling when every column remains necessary for comparison."
        />
        <p className="text-muted text-sm">Focus the table region, then scroll horizontally on a narrow canvas.</p>
        <FleetTable narrow="scroll" />
      </Stack>
    </PageFrame>
  )
}

const meta = {
  title: 'Components/Data display',
  component: DataDisplayOverview,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof DataDisplayOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}
export const Lists: Story = {
  render: () => <PageFrame><Section title="Active missions"><MissionList /></Section></PageFrame>
}
export const PriorityTable: Story = {
  render: () => <PageFrame><Section title="Fleet"><FleetTable /></Section></PageFrame>
}
export const ScrollableTable: Story = { render: () => <ScrollTable /> }
