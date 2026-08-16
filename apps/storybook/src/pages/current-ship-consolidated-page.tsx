import { CommandTile } from '@phoenix/ui'
import { Button } from '@phoenix/ui'
import { ControlContext } from '@phoenix/ui'
import { DescriptionItem, DescriptionList } from '@phoenix/ui'
import { Meter } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'
import { Widget } from '@phoenix/ui'

type CurrentShipArrangement = 'controls-left' | 'systems-left'

type CurrentShipConsolidatedPageProps = {
  actionStyle?: 'primary' | 'tile'
  arrangement?: CurrentShipArrangement
  meterLayout?: 'stacked' | 'inline'
}

function VesselPanels() {
  return (
    <>
      <Widget className="fixed-data" title="Vessel">
        <DescriptionList className="adaptive-columns" columns="two" density="compact">
          <DescriptionItem label="Name" value="Unnamed vessel" />
          <DescriptionItem label="Identifier" value="EL-06L" />
          <DescriptionItem label="Model" value="Type-11 Prospector" />
          <DescriptionItem label="Manufacturer" value="Lakon Spaceways" />
          <DescriptionItem label="Landing pad" value="Medium" />
          <DescriptionItem label="Hull value" value="67,861,850 CR" />
        </DescriptionList>
      </Widget>

      <Widget className="fixed-data" title="Operational status">
        <DescriptionList className="adaptive-columns" columns="two" density="compact">
          <DescriptionItem label="Unladen mass" value="599.8 t" />
          <DescriptionItem label="Jump range" value="22.4 ly" />
          <DescriptionItem label="Modules value" value="51,746,423 CR" />
          <DescriptionItem label="Rebuy cost" value="5,980,416 CR" />
          <DescriptionItem label="Modules" value="36" />
          <DescriptionItem label="Legal state" value="Clean" />
        </DescriptionList>
      </Widget>
    </>
  )
}

function IntegrityPanel({ meterLayout }: { meterLayout: 'stacked' | 'inline' }) {
  return (
    <Widget title="Integrity">
      <div className="meter-stack">
        <Meter label="Hull" layout={meterLayout} tone="action" value={100} valueLabel="100%" />
        <Meter label="Shields" layout={meterLayout} tone="action" value={100} valueLabel="100%" />
      </div>
    </Widget>
  )
}

function FuelPanel({ meterLayout }: { meterLayout: 'stacked' | 'inline' }) {
  return (
    <Widget title="Fuel">
      <div className="meter-stack">
        <Meter label="Main fuel" layout={meterLayout} tone="action" value={78} valueLabel="78%" />
        <Meter label="Reservoir" layout={meterLayout} tone="action" value={42} valueLabel="42%" />
      </div>
    </Widget>
  )
}

function CargoPanel({ meterLayout }: { meterLayout: 'stacked' | 'inline' }) {
  return (
    <Widget title="Cargo">
      <div className="cargo-content">
        <Meter layout={meterLayout} max={196} tone="action" value={45} valueLabel="45 / 196 t" label="Capacity" />
        <DescriptionList aria-label="Cargo manifest" columns="one" density="compact" inset tabIndex={0}>
          <DescriptionItem label="Limpets" value="3 t" />
          <DescriptionItem label="Platinum" value="18 t" />
          <DescriptionItem label="Osmium" value="7 t" />
          <DescriptionItem label="Painite" value="5 t" />
          <DescriptionItem label="Alexandrite" value="4 t" />
          <DescriptionItem label="Monazite" value="6 t" />
          <DescriptionItem label="Serendibite" value="2 t" />
        </DescriptionList>
      </div>
    </Widget>
  )
}

function ShipControls() {
  return (
    <ControlContext className="command-grid" context="command">
      <CommandTile binding="Numpad_Decimal" label="Hardpoints" />
      <CommandTile binding="Numpad_1" label="Landing gear" selected />
      <CommandTile label="Cargo scoop" />
      <CommandTile binding="L" label="Lights" />
      <CommandTile binding="Numpad_9" label="Night vision" />
      <CommandTile label="Flight assist" />
    </ControlContext>
  )
}

function ShipActions({ actionStyle }: { actionStyle: 'primary' | 'tile' }) {
  return (
    <div className="actions">
      {actionStyle === 'tile' ? (
        <>
          <CommandTile details={false} label="Loadout" />
          <CommandTile details={false} label="Engineering" />
        </>
      ) : (
        <>
          <Button size="lg" variant="primary">LOADOUT</Button>
          <Button size="lg" variant="primary">ENGINEERING</Button>
        </>
      )}
    </div>
  )
}

export function CurrentShipConsolidatedPage({
  actionStyle = 'primary',
  arrangement = 'controls-left',
  meterLayout = 'stacked'
}: CurrentShipConsolidatedPageProps) {
  const systemsLeft = arrangement === 'systems-left'

  return (
    <PageFrame layout="fit">
      <div className={`current-ship consolidated ${arrangement}`}>
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Current ship' }]} />}
          title="Type-11 Prospector"
        />

        <div className="ship-grid">
          <div className="vessel-column">
            <VesselPanels />
            {systemsLeft ? (
              <>
                <div className="systems-row">
                  <IntegrityPanel meterLayout={meterLayout} />
                  <FuelPanel meterLayout={meterLayout} />
                </div>
                <ShipActions actionStyle={actionStyle} />
              </>
            ) : <ShipControls />}
          </div>

          <div className="instrument-column">
            {systemsLeft ? (
              <>
                <CargoPanel meterLayout={meterLayout} />
                <ShipControls />
              </>
            ) : (
              <>
                <IntegrityPanel meterLayout={meterLayout} />
                <FuelPanel meterLayout={meterLayout} />
                <CargoPanel meterLayout={meterLayout} />
                <ShipActions actionStyle={actionStyle} />
              </>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
  )
}
