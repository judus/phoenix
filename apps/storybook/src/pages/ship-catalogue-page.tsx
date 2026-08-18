import { useState } from 'react'

import { CommandTile } from '@phoenix/ui'
import { DataTable } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'
import { ViewSwitcher } from '@phoenix/ui'

interface Ship {
  id: string
  displayName: string
  manufacturer: string | null
  landingPadSize: 'small' | 'medium' | 'large' | null
  performance: {
    baseArmour: number | null
    baseShieldStrength: number | null
    speed: number | null
    boost: number | null
    hullMass: number | null
  }
  slots: Record<'core' | 'optional' | 'hardpoints' | 'utilities', Array<{ size: number }>>
}
type SortKey = 'displayName' | 'manufacturer' | 'landingPadSize' | 'baseArmour' | 'baseShieldStrength' | 'speed' | 'boost' | 'hullMass'
type CatalogueView = 'dossier' | 'table'

const fixtureShips: Ship[] = [
  syntheticShip('courier_fixture', 'Courier Fixture', 'Small Batch Works', 'small', 2),
  syntheticShip('explorer_fixture', 'Explorer Fixture', 'Synthetic Aerospace', 'medium', 3),
  syntheticShip('freighter_fixture', 'Freighter Fixture', 'Fixture Works', 'large', 4)
]
const ships = [...fixtureShips].sort((left, right) =>
  left.displayName.localeCompare(right.displayName)
)

function syntheticShip (
  id: string,
  displayName: string,
  manufacturer: string,
  landingPadSize: Ship['landingPadSize'],
  scale: number
): Ship {
  return {
    id,
    displayName,
    manufacturer,
    landingPadSize,
    performance: {
      baseArmour: 50 * scale,
      baseShieldStrength: 30 * scale,
      speed: 260 - 10 * scale,
      boost: 340 - 10 * scale,
      hullMass: 20 * scale
    },
    slots: {
      core: [{ size: scale }, { size: scale }, { size: Math.max(1, scale - 1) }],
      optional: [{ size: scale }, { size: Math.max(1, scale - 1) }],
      hardpoints: [{ size: Math.max(1, scale - 1) }],
      utilities: [{ size: 0 }, { size: 0 }]
    }
  }
}

function valueOrDash(value: number | null, unit = '') {
  return value === null ? '—' : `${value.toLocaleString()}${unit}`
}

function HullRoster({ current, onSelect }: { current: string, onSelect: (ship: Ship) => void }) {
  return (
    <section className="hull-roster">
      <DataTable density="compact" label="Known ship hulls" narrow="priority">
        <tbody>
          {ships.map((ship) => (
            <tr
              className={ship.id === current ? 'active' : undefined}
              aria-selected={ship.id === current}
              tabIndex={0}
              key={ship.id}
              onClick={() => onSelect(ship)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(ship)
                }
              }}
            >
              <td>
                <strong>{ship.displayName}</strong>
                <small>{ship.manufacturer ?? '—'}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  )
}

function CapacityRow({ label, slots }: { label: string, slots: Array<{ size: number }> }) {
  return (
    <section>
      <header>
        <h4>{label}</h4>
        <small>{slots.length}</small>
      </header>
      <ol>
        {slots.map((slot, index) => <li key={`${label}-${index}`}>S{slot.size}</li>)}
      </ol>
    </section>
  )
}

function HullSchematic({ ship }: { ship: Ship }) {
  const slotCount = Object.values(ship.slots).reduce((count, slots) => count + slots.length, 0)

  return (
    <article className="hull-schematic">
      <header>
        <div>
          <h2>{ship.displayName}</h2>
          <p>{ship.manufacturer ?? 'Unknown manufacturer'}</p>
        </div>
        <span>{ship.landingPadSize ?? 'unknown'} pad</span>
      </header>

      <dl className="flight-profile">
        <div><dt>Armour</dt><dd>{valueOrDash(ship.performance.baseArmour)}</dd></div>
        <div><dt>Shield</dt><dd>{valueOrDash(ship.performance.baseShieldStrength)}</dd></div>
        <div><dt>Speed</dt><dd>{valueOrDash(ship.performance.speed, ' m/s')}</dd></div>
        <div><dt>Boost</dt><dd>{valueOrDash(ship.performance.boost, ' m/s')}</dd></div>
        <div><dt>Mass</dt><dd>{valueOrDash(ship.performance.hullMass, ' t')}</dd></div>
        <div><dt>Price</dt><dd>— CR</dd></div>
      </dl>

      <section className="capacity-matrix">
        <header>
          <h3>Frame capacity</h3>
          <small>{slotCount} positions</small>
        </header>
        <div>
          <CapacityRow label="Core" slots={ship.slots.core} />
          <CapacityRow label="Optional" slots={ship.slots.optional} />
          <CapacityRow label="Hardpoints" slots={ship.slots.hardpoints} />
          <CapacityRow label="Utility" slots={ship.slots.utilities} />
        </div>
      </section>

      <div className="catalogue-actions">
        <CommandTile details={false} label="Compare" />
        <CommandTile details={false} label="Shipyards" />
      </div>
    </article>
  )
}

export function ShipCataloguePage() {
  const [selected, setSelected] = useState<Ship>(ships[0])
  const [view, setView] = useState<CatalogueView>('dossier')

  return (
    <PageFrame layout="fit">
      <div className="ship-catalogue schematic">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Ship catalogue' }]} />}
          status="Synthetic Storybook fixture"
          title="Ship catalogue"
          actions={
            <ViewSwitcher
              startLabel="Dossier"
              startIcon={<svg aria-hidden="true" viewBox="0 0 16 16">
                <rect x="2" y="2" width="12" height="12" />
                <path d="M4 5h8M4 8h3M8 8h4M4 11h5M10 11h2" />
              </svg>}
              endLabel="Table"
              endIcon={<svg aria-hidden="true" viewBox="0 0 16 16">
                <rect x="2" y="2" width="12" height="12" />
                <path d="M2 6h12M7 2v12" />
              </svg>}
              position={view === 'dossier' ? 'start' : 'end'}
              onPositionChange={(position) => setView(position === 'start' ? 'dossier' : 'table')}
            />
          }
        />
        {view === 'dossier' ? (
          <div className="catalogue-deck">
            <HullRoster current={selected.id} onSelect={setSelected} />
            <HullSchematic ship={selected} />
          </div>
        ) : (
          <CatalogueTable
            selected={selected}
            onSelect={(ship) => {
              setSelected(ship)
              setView('dossier')
            }}
          />
        )}
      </div>
    </PageFrame>
  )
}

function CatalogueTable({
  selected,
  onSelect
}: {
  selected: Ship
  onSelect: (ship: Ship) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('displayName')
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending')
  const visibleShips = [...ships].sort((left, right) => {
    const values = {
      displayName: [left.displayName, right.displayName],
      manufacturer: [left.manufacturer, right.manufacturer],
      landingPadSize: [left.landingPadSize, right.landingPadSize],
      baseArmour: [left.performance.baseArmour, right.performance.baseArmour],
      baseShieldStrength: [left.performance.baseShieldStrength, right.performance.baseShieldStrength],
      speed: [left.performance.speed, right.performance.speed],
      boost: [left.performance.boost, right.performance.boost],
      hullMass: [left.performance.hullMass, right.performance.hullMass]
    }[sortKey]
    const [leftValue, rightValue] = values

    if (leftValue === null) return rightValue === null ? 0 : 1
    if (rightValue === null) return -1

    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue))

    return sortDirection === 'ascending' ? comparison : -comparison
  })

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending')
      return
    }

    setSortKey(nextKey)
    setSortDirection('ascending')
  }

  function sortState(key: SortKey) {
    return sortKey === key ? sortDirection : 'none'
  }

  return (
    <div className="catalogue-table-view">
      <DataTable density="compact" label="Known ship hulls" minimum="wide" scheme="information" stickyHeader>
        <thead>
          <tr>
            <th scope="col" aria-sort={sortState('displayName')}><button onClick={() => changeSort('displayName')}>Hull</button></th>
            <th scope="col" aria-sort={sortState('manufacturer')}><button onClick={() => changeSort('manufacturer')}>Manufacturer</button></th>
            <th scope="col" aria-sort={sortState('landingPadSize')}><button onClick={() => changeSort('landingPadSize')}>Pad</button></th>
            <th className="numeric" scope="col" aria-sort={sortState('baseArmour')}><button onClick={() => changeSort('baseArmour')}>Armour</button></th>
            <th className="numeric" scope="col" aria-sort={sortState('baseShieldStrength')}><button onClick={() => changeSort('baseShieldStrength')}>Shield</button></th>
            <th className="numeric" scope="col" aria-sort={sortState('speed')}><button onClick={() => changeSort('speed')}>Speed</button></th>
            <th className="numeric" scope="col" aria-sort={sortState('boost')}><button onClick={() => changeSort('boost')}>Boost</button></th>
            <th className="numeric" scope="col" aria-sort={sortState('hullMass')}><button onClick={() => changeSort('hullMass')}>Mass</button></th>
            <th className="numeric" scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {visibleShips.map((ship) => (
            <tr
              className={selected.id === ship.id ? 'active' : undefined}
              aria-selected={selected.id === ship.id}
              tabIndex={0}
              key={ship.id}
              onClick={() => onSelect(ship)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(ship)
                }
              }}
            >
              <th scope="row">{ship.displayName}</th>
              <td>{ship.manufacturer ?? '—'}</td>
              <td>{ship.landingPadSize ?? '—'}</td>
              <td className="numeric">{ship.performance.baseArmour ?? '—'}</td>
              <td className="numeric">{ship.performance.baseShieldStrength ?? '—'}</td>
              <td className="numeric">{valueOrDash(ship.performance.speed, ' m/s')}</td>
              <td className="numeric">{valueOrDash(ship.performance.boost, ' m/s')}</td>
              <td className="numeric">{valueOrDash(ship.performance.hullMass, ' t')}</td>
              <td className="numeric">— CR</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  )
}
