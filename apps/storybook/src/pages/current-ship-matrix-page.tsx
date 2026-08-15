import { DescriptionItem, DescriptionList } from '../components/description-list'
import { Meter } from '../components/meter'
import { Metric } from '../components/metric'
import { PageFrame, PageHeader, Panel } from '../components/page'
import { Status } from '../components/status'
import { Tabs, type TabItem } from '../components/tabs'
import './current-ship-page.css'

const shipTabs: TabItem[] = [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'loadout', label: 'Loadout', href: '#loadout' },
  { id: 'cargo', label: 'Cargo', href: '#cargo' }
]

export function CurrentShipMatrixPage() {
  return (
    <PageFrame layout="fit">
      <div className="current-ship">
        <PageHeader
          variant="cockpit"
          context="Current ship"
          title="Type-11 Prospector"
          navigation={<Tabs label="Ship sections" current="overview" items={shipTabs} />}
        />

        <div className="ship-grid matrix">
          <Panel className="vessel-panel" variant="cockpit" title="Vessel">
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
          </Panel>

          <Panel className="performance-panel" variant="cockpit" title="Performance">
            <div className="performance-content">
              <div className="readout-grid four-columns">
                <Metric density="compact" label="Jump" value="22.4 ly" />
                <Metric density="compact" label="Mass" value="599.8 t" />
                <Metric density="compact" label="Cargo" value="3 / 196" />
                <Metric density="compact" label="Hull" value="100%" />
              </div>
              <Meter label="Cargo hold" max={196} value={3} valueLabel="3 / 196" />
              <Meter label="Hull integrity" value={100} valueLabel="100 / 100" />
            </div>
          </Panel>

          <Panel className="status-panel" variant="cockpit" title="Live status">
            <div className="status-grid">
              <Status tone="positive">Shields</Status>
              <Status tone="muted">Hardpoints</Status>
              <Status tone="warning">Landing gear</Status>
              <Status tone="muted">Cargo scoop</Status>
              <Status tone="muted">Lights</Status>
              <Status tone="muted">Night vision</Status>
              <Status tone="muted">Flight assist</Status>
              <Status tone="positive">Modules nominal</Status>
            </div>
            <DescriptionList columns="two" density="compact">
              <DescriptionItem label="Legal state" value="Clean" />
              <DescriptionItem label="Fire group" value="A" />
              <DescriptionItem label="Weapon" value="Mining laser" />
              <DescriptionItem label="GUI focus" value="Internal panel" />
            </DescriptionList>
          </Panel>

          <Panel className="power-panel" variant="cockpit" title="Power and stores">
            <div className="power-content">
              <div className="readout-grid four-columns">
                <Metric density="compact" label="Systems" value="4" />
                <Metric density="compact" label="Engines" value="2" />
                <Metric density="compact" label="Weapons" value="0" />
                <Metric density="compact" label="Engineered" value="1" />
              </div>
              <Meter label="Main fuel" value={78} valueLabel="78%" />
              <Meter label="Reservoir" value={42} valueLabel="42%" tone="warning" />
              <Status tone="positive">No module damage</Status>
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  )
}
