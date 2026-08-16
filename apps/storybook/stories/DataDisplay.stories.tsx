import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@phoenix/ui'
import { DataTable, DataTableGroup } from '@phoenix/ui'
import { ItemList, ItemListItem } from '@phoenix/ui'
import { Stack } from '@phoenix/ui'
import { PageFrame, PageHeader, Section } from '@phoenix/ui'
import { Status } from '@phoenix/ui'
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
          <th scope="row"><strong>Nightjar</strong><small>Krait Mk II</small></th>
          <td><Status tone="positive">Active</Status></td>
          <td className="priority-secondary">Multipurpose</td>
          <td className="priority-secondary">Col 285 Sector OK-C B14-5</td>
          <td className="priority-tertiary numeric">31.4 ly</td>
          <td className="priority-tertiary">2 min ago</td>
        </tr>
        <tr>
          <th scope="row"><strong>Far Lantern</strong><small>Diamondback Explorer</small></th>
          <td><Status tone="information">Stored</Status></td>
          <td className="priority-secondary">Exploration</td>
          <td className="priority-secondary">Jameson Memorial</td>
          <td className="priority-tertiary numeric">67.8 ly</td>
          <td className="priority-tertiary">Yesterday</td>
        </tr>
        <tr>
          <th scope="row"><strong>Red Shift</strong><small>Fer-de-Lance</small></th>
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

const storedModules = [
  ['Frag Cannon', '$hpt_slushot_gimbal_small_name;', 'Weapon Efficient G1', '58', '41m · 808 CR', '54,720 CR'],
  ['Frag Cannon', '$hpt_slugshot_gimbal_small_name;', 'Weapon Efficient G1', '59', '41m · 808 CR', '54,720 CR'],
  ['Beam Laser', '$hpt_beamlaser_gimbal_small_name;', '—', '67', '41m · 970 CR', '67,185 CR'],
  ['Beam Laser', '$hpt_beamlaser_gimbal_small_name;', '—', '68', '41m · 970 CR', '67,185 CR'],
  ['Multi-Cannon', '$hpt_multicannon_gimbal_medium_name;', '—', '70', '41m · 764 CR', '51,300 CR'],
  ['Plasma Accelerator', '$hpt_plasmaaccelerator_fixed_large_name;', '—', '72', '41m · 39,616 CR', '3,051,200 CR']
]

const catalogueRows = [
  ['Adder', 'Zorgon Peterson', 'small', '90', '60', '220 m/s'],
  ['Alliance Challenger', 'Lakon', 'medium', '300', '220', '204 m/s'],
  ['Alliance Chieftain', 'Lakon', 'medium', '280', '200', '230 m/s'],
  ['Anaconda', 'Faulcon DeLacy', 'large', '525', '350', '180 m/s']
]

type TableOptions = {
  activeRow?: boolean
  density?: 'compact' | 'standard' | 'comfortable'
  scheme?: 'default' | 'surface' | 'information'
}

function CatalogueTable({ activeRow = false, density = 'standard', scheme = 'default' }: TableOptions) {
  return (
    <DataTable density={density} label="Ship catalogue" minimum="wide" scheme={scheme}>
      <thead>
        <tr>
          <th scope="col">Hull</th>
          <th scope="col">Manufacturer</th>
          <th scope="col">Pad</th>
          <th className="numeric" scope="col">Armour</th>
          <th className="numeric" scope="col">Shield</th>
          <th className="numeric" scope="col">Speed</th>
        </tr>
      </thead>
      <tbody>
        {catalogueRows.map(([hull, manufacturer, pad, armour, shield, speed], index) => (
          <tr className={activeRow && index === 1 ? 'active' : undefined} key={hull}>
            <th scope="row">{hull}</th>
            <td>{manufacturer}</td>
            <td>{pad}</td>
            <td className="numeric">{armour}</td>
            <td className="numeric">{shield}</td>
            <td className="numeric">{speed}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

function ModuleTable({ density = 'standard', scheme = 'default' }: TableOptions) {
  return (
    <DataTable density={density} label="Modules stored at Atata" minimum="wide" scheme={scheme}>
      <thead>
        <tr>
          <th scope="col">Module</th>
          <th scope="col">Engineering</th>
          <th className="numeric" scope="col">Storage slot</th>
          <th scope="col">Transfer</th>
          <th className="numeric" scope="col">Purchase value</th>
          <th scope="col">Observed</th>
        </tr>
      </thead>
      <tbody>
        {storedModules.slice(0, 4).map(([name, identifier, engineering, slot, transfer, value]) => (
          <tr key={slot}>
            <th scope="row">
              <strong>{name}</strong>
              <small>{identifier}</small>
            </th>
            <td className={engineering !== '—' ? 'text-information' : undefined}>{engineering}</td>
            <td className="numeric">{slot}</td>
            <td>{transfer}</td>
            <td className="numeric">{value}</td>
            <td>9 Aug · 14:46</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

const moduleStates = [
  ['Active', '7A Power Distributor', 'Charge Enhanced G4', '100%', 'active'],
  ['Standard', '5C Fuel Tank', 'Standard', '100%', undefined],
  ['Engineered', '6A Power Plant', 'Overcharged G3', '100%', 'engineered'],
  ['Engineered max', '5A Frame Shift Drive', 'Increased Range G5', '100%', 'engineered-max'],
  ['Broken', '3D Sensors', 'Lightweight G3', '0%', 'broken'],
  ['Disabled', '3D Life Support', 'Standard', '100%', 'disabled']
]

function TableRowStates({ scheme = 'default' }: Pick<TableOptions, 'scheme'>) {
  return (
    <DataTable density="comfortable" label={`${scheme} module row states`} minimum="wide" scheme={scheme}>
      <thead>
        <tr>
          <th scope="col">State</th>
          <th scope="col">Module</th>
          <th scope="col">Engineering</th>
          <th className="numeric" scope="col">Condition</th>
        </tr>
      </thead>
      <tbody>
        {moduleStates.map(([state, module, engineering, condition, className]) => (
          <tr className={className} key={state}>
            <th scope="row">{state}</th>
            <td>{module}</td>
            <td className={engineering !== 'Standard' ? 'text-information' : undefined}>{engineering}</td>
            <td className="numeric">{condition}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

function GroupedTable() {
  return (
    <DataTableGroup meta="61 modules" title="Atata">
      <ModuleTable />
    </DataTableGroup>
  )
}

function TableSchemes() {
  return (
    <Stack gap="xl">
      <DataTableGroup meta="Default" title="No color mutator"><CatalogueTable activeRow /></DataTableGroup>
      <DataTableGroup meta=".surface" title="Surface"><CatalogueTable activeRow scheme="surface" /></DataTableGroup>
      <DataTableGroup meta=".information" title="Information"><CatalogueTable activeRow scheme="information" /></DataTableGroup>
    </Stack>
  )
}

function TableStateSchemes() {
  return (
    <Stack gap="xl">
      <DataTableGroup meta="Default" title="No color mutator"><TableRowStates /></DataTableGroup>
      <DataTableGroup meta=".surface" title="Surface"><TableRowStates scheme="surface" /></DataTableGroup>
    </Stack>
  )
}

function TableDensities() {
  return (
    <Stack gap="xl">
      <DataTableGroup meta=".compact" title="Compact"><CatalogueTable density="compact" /></DataTableGroup>
      <DataTableGroup meta="Default" title="Standard"><CatalogueTable /></DataTableGroup>
      <DataTableGroup meta=".comfortable" title="Comfortable"><CatalogueTable density="comfortable" /></DataTableGroup>
    </Stack>
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
export const ScrollableTable: Story = { render: () => <ScrollTable /> }
export const DefaultDataTable: Story = { render: () => <PageFrame><CatalogueTable /></PageFrame> }
export const GroupedDataTable: Story = { render: () => <PageFrame><GroupedTable /></PageFrame> }
export const ColorSchemes: Story = { render: () => <PageFrame><TableSchemes /></PageFrame> }
export const DensityMutators: Story = { render: () => <PageFrame><TableDensities /></PageFrame> }
export const RowStates: Story = { render: () => <PageFrame><TableStateSchemes /></PageFrame> }
