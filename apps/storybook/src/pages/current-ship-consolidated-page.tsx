import { CommandTile } from '../components/command-tile'
import { Button } from '../components/button'
import { ControlContext } from '../components/control-context'
import { DescriptionItem, DescriptionList } from '../components/description-list'
import { Meter } from '../components/meter'
import { Breadcrumbs, PageFrame, PageHeader, Panel } from '../components/page'
import './current-ship-page.css'
import './current-ship-consolidated-page.css'

export function CurrentShipConsolidatedPage() {
  return (
    <PageFrame layout="fit">
      <div className="current-ship consolidated">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Current ship' }]} />}
          title="Type-11 Prospector"
        />

        <div className="ship-grid">
          <div className="vessel-column">
            <Panel className="fixed-data" variant="cockpit" title="Vessel">
              <DescriptionList columns="one" density="compact">
                <DescriptionItem label="Name" value="—" />
                <DescriptionItem label="Identifier" value="EL-06L" />
                <DescriptionItem label="Manufacturer" value="Lakon Spaceways" />
                <DescriptionItem label="Landing pad" value="Medium" />
                <DescriptionItem label="Hull value" value="67,861,850 CR" />
              </DescriptionList>
            </Panel>

            <Panel className="fixed-data" variant="cockpit" title="Operational status">
              <div className="panel-stack">
                <DescriptionList columns="one" density="compact">
                  <DescriptionItem label="Unladen mass" value="599.8 t" />
                  <DescriptionItem label="Jump range" value="22.4 ly" />
                  <DescriptionItem label="Modules value" value="51,746,423 CR" />
                  <DescriptionItem label="Rebuy cost" value="5,980,416 CR" />
                  <DescriptionItem label="Modules" value="36" />
                  <DescriptionItem label="Legal state" value="Clean" />
                </DescriptionList>
                <Button size="sm" variant="primary">Loadout</Button>
              </div>
            </Panel>

            <Panel variant="cockpit" title="Cargo">
              <div className="cargo-content">
                <Meter max={196} tone="action" value={45} valueLabel="45 / 196 t" label="Capacity" />
                <DescriptionList aria-label="Cargo manifest" columns="one" density="compact" inset tabIndex={0}>
                  <DescriptionItem label="Limpets" value="3 t" />
                  <DescriptionItem label="Platinum" value="18 t" />
                  <DescriptionItem label="Osmium" value="7 t" />
                  <DescriptionItem label="Painite" value="5 t" />
                  <DescriptionItem label="Alexandrite" value="4 t" />
                  <DescriptionItem label="Monazite" value="6 t" />
                  <DescriptionItem label="Serendibite" value="2 t" />
                </DescriptionList>
                <Button size="sm" variant="primary">Manifest</Button>
              </div>
            </Panel>
          </div>

          <div className="instrument-column">
            <Panel variant="cockpit" title="Integrity">
              <div className="meter-stack">
                <Meter label="Hull" tone="action" value={100} valueLabel="100%" />
                <Meter label="Shields" tone="action" value={100} valueLabel="100%" />
              </div>
            </Panel>

            <Panel variant="cockpit" title="Fuel">
              <div className="meter-stack">
                <Meter label="Main fuel" tone="action" value={78} valueLabel="78%" />
                <Meter label="Reservoir" tone="action" value={42} valueLabel="42%" />
              </div>
            </Panel>

            <Panel variant="cockpit" title="Ship controls">
              <ControlContext className="command-grid" context="command" density="compact">
                <CommandTile binding="Numpad_Decimal" label="Hardpoints" />
                <CommandTile binding="Numpad_1" label="Landing gear" selected />
                <CommandTile label="Cargo scoop" />
                <CommandTile binding="L" label="Lights" />
                <CommandTile binding="Numpad_9" label="Night vision" />
                <CommandTile label="Flight assist" />
              </ControlContext>
            </Panel>
          </div>
        </div>
      </div>
    </PageFrame>
  )
}
