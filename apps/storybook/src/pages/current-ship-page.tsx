import { ControlContext } from '@phoenix/ui'
import { DescriptionItem, DescriptionList } from '@phoenix/ui'
import { Meter } from '@phoenix/ui'
import { Metric } from '@phoenix/ui'
import { PageFrame, PageHeader, Panel } from '@phoenix/ui'
import { Tabs, type TabItem } from '@phoenix/ui'
import { ToggleButton } from '@phoenix/ui'
import './current-ship-page.css'

const shipTabs: TabItem[] = [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'loadout', label: 'Loadout', href: '#loadout' },
  { id: 'cargo', label: 'Cargo', href: '#cargo' }
]

export function CurrentShipPage() {
  return (
    <PageFrame layout="fit">
      <div className="current-ship">
        <PageHeader
          variant="cockpit"
          context="Current ship"
          title="Type-11 Prospector"
          navigation={<Tabs label="Ship sections" current="overview" items={shipTabs} />}
        />

        <div className="ship-grid">
          <Panel className="vessel-panel" variant="cockpit" title="Vessel">
            <div className="vessel-content">
              <DescriptionList columns="two" density="compact">
                <DescriptionItem label="Identifier" value="EL-06L" />
                <DescriptionItem label="Manufacturer" value="Lakon Spaceways" />
                <DescriptionItem label="Landing pad" value="Medium" />
                <DescriptionItem label="Unladen mass" value="599.8 t" />
                <DescriptionItem label="Hull value" value="67,861,850 CR" />
                <DescriptionItem label="Modules value" value="51,746,423 CR" />
                <DescriptionItem label="Rebuy cost" value="5,980,416 CR" />
                <DescriptionItem label="Modules" value="36 · 1 engineered" />
              </DescriptionList>

              <DescriptionList columns="two" density="compact">
                <DescriptionItem label="Legal state" value="Clean" />
                <DescriptionItem label="Weapon" value="Mining laser" />
                <DescriptionItem label="Fire group" value="A" />
              </DescriptionList>

              <ControlContext className="control-grid" context="toolbar" density="compact">
                <ToggleButton pressed>Shields</ToggleButton>
                <ToggleButton pressed={false}>Hardpoints</ToggleButton>
                <ToggleButton pressed tone="warning">Landing gear</ToggleButton>
                <ToggleButton pressed={false}>Cargo scoop</ToggleButton>
                <ToggleButton pressed={false}>Lights</ToggleButton>
                <ToggleButton pressed={false}>Night vision</ToggleButton>
                <ToggleButton pressed={false}>Flight assist</ToggleButton>
              </ControlContext>
            </div>
          </Panel>

          <Panel className="performance-panel" variant="cockpit" title="Performance">
            <div className="performance-content">
              <div className="readout-grid">
                <Metric density="compact" label="Jump" value="22.4 ly" />
                <Metric density="compact" label="Mass" value="599.8 t" />
              </div>
              <Meter label="Cargo" max={196} value={3} valueLabel="3 / 196" />
              <Meter label="Hull" value={100} valueLabel="100 / 100" />
            </div>
          </Panel>

          <Panel className="power-panel" variant="cockpit" title="Power and stores">
            <div className="power-content">
              <div className="readout-grid">
                <Metric density="compact" label="Systems" value="4" />
                <Metric density="compact" label="Engines" value="2" />
                <Metric density="compact" label="Weapons" value="0" />
              </div>
              <Meter label="Main fuel" value={78} valueLabel="78%" />
              <Meter label="Reservoir" value={42} valueLabel="42%" tone="warning" />
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  )
}
