import { useState } from 'react'

import catalogue from '../../../../data/catalogue/ships.json'
import { CommandTile } from '../components/command-tile'
import { DataTable } from '../components/data-table'
import { DescriptionItem, DescriptionList } from '../components/description-list'
import { TextInput } from '../components/field'
import { Breadcrumbs, PageFrame, PageHeader } from '../components/page'
import './ship-catalogue-page.css'

type Ship = (typeof catalogue.ships)[number]
type SortKey = 'displayName' | 'manufacturer' | 'landingPadSize' | 'baseArmour' | 'baseShieldStrength' | 'speed' | 'boost' | 'hullMass'
type DossierSortKey = 'displayName' | 'manufacturer' | 'landingPadSize'

const ships = [...catalogue.ships].sort((left, right) =>
  left.displayName.localeCompare(right.displayName)
)

function valueOrDash(value: number | null, unit = '') {
  return value === null ? '—' : `${value.toLocaleString()}${unit}`
}

function SlotBank({
  label,
  slots
}: {
  label: string
  slots: Array<{ name?: string | null, size: number }>
}) {
  return (
    <section>
      <header>
        <h3>{label}</h3>
        <small>{slots.length}</small>
      </header>
      <ol>
        {slots.map((slot, index) => (
          <li key={`${slot.name ?? label}-${index}`} title={slot.name ?? `${label} slot`}>
            S{slot.size}
          </li>
        ))}
      </ol>
    </section>
  )
}

function HullIndex({ current, onSelect }: { current: string, onSelect: (ship: Ship) => void }) {
  return (
    <nav className="hull-index" aria-label="Known ship hulls">
      <header>
        <h2>Known hulls</h2>
        <small>{ships.length} · A–Z</small>
      </header>
      <ol>
        {ships.map((ship) => (
          <li key={ship.id}>
            <button
              className={ship.id === current ? 'active' : undefined}
              aria-current={ship.id === current ? 'page' : undefined}
              onClick={() => onSelect(ship)}
            >
              <strong>{ship.displayName}</strong>
              <small>
                {ship.manufacturer ?? 'Unknown manufacturer'}
                {' · '}
                {ship.landingPadSize ?? 'unknown'} pad
              </small>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
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
              <th scope="row">
                <strong>{ship.displayName}</strong>
                <small>{ship.manufacturer ?? '—'}</small>
              </th>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  )
}

function HullRecord({ ship }: { ship: Ship }) {
  return (
    <article className="hull-record">
      <header>
        <small>Hull definition</small>
        <h2>{ship.displayName}</h2>
        <p>{ship.manufacturer ?? 'Unknown manufacturer'} · {ship.landingPadSize ?? 'unknown'} pad</p>
      </header>

      <DescriptionList columns="two" density="compact">
        <DescriptionItem label="Base armour" value={valueOrDash(ship.performance.baseArmour)} />
        <DescriptionItem label="Base shield" value={valueOrDash(ship.performance.baseShieldStrength)} />
        <DescriptionItem label="Speed" value={valueOrDash(ship.performance.speed, ' m/s')} />
        <DescriptionItem label="Boost" value={valueOrDash(ship.performance.boost, ' m/s')} />
        <DescriptionItem label="Hull mass" value={valueOrDash(ship.performance.hullMass, ' t')} />
        <DescriptionItem label="Frontier ID" value={ship.identifiers.frontierEdId ?? '—'} />
      </DescriptionList>

      <div className="slot-banks">
        <SlotBank label="Core internals" slots={ship.slots.core} />
        <SlotBank label="Optional internals" slots={ship.slots.optional} />
        <SlotBank label="Hardpoints" slots={ship.slots.hardpoints} />
        <SlotBank label="Utility mounts" slots={ship.slots.utilities} />
      </div>

      <div className="catalogue-actions">
        <CommandTile details={false} label="Compare" />
        <CommandTile details={false} label="Shipyards" />
      </div>
    </article>
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

export function ShipCatalogueFirstPassPage() {
  const [selected, setSelected] = useState<Ship>(ships[0])

  return (
    <PageFrame layout="fit">
      <div className="ship-catalogue">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Ship catalogue' }]} />}
          title="Ship catalogue"
        />
        <div className="catalogue-body">
          <HullIndex current={selected.id} onSelect={setSelected} />
          <HullRecord ship={selected} />
        </div>
      </div>
    </PageFrame>
  )
}

export function ShipCataloguePage() {
  const [selected, setSelected] = useState<Ship>(ships[0])

  return (
    <PageFrame layout="fit">
      <div className="ship-catalogue schematic">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Ship catalogue' }]} />}
          title="Ship catalogue"
        />
        <div className="catalogue-deck">
          <HullRoster current={selected.id} onSelect={setSelected} />
          <HullSchematic ship={selected} />
        </div>
      </div>
    </PageFrame>
  )
}

function ShipDetailsPanel({ ship, onClose }: { ship: Ship, onClose: () => void }) {
  const slotCount = Object.values(ship.slots).reduce((count, slots) => count + slots.length, 0)

  return (
    <aside className="hull-sidepanel" aria-label={`${ship.displayName} details`}>
      <header>
        <div>
          <h2>{ship.displayName}</h2>
          <p>{ship.manufacturer ?? 'Unknown manufacturer'} · {ship.landingPadSize ?? 'unknown'} pad</p>
        </div>
        <button aria-label="Close ship details" onClick={onClose}>×</button>
      </header>

      <figure>
        <div aria-hidden="true">{ship.displayName}</div>
      </figure>

      <div className="sidepanel-summary">
        <span>{slotCount} module positions</span>
        <span>FDev {ship.identifiers.frontierEdId ?? '—'}</span>
      </div>

      <div className="sidepanel-capacity">
        <CapacityRow label="Core" slots={ship.slots.core} />
        <CapacityRow label="Optional" slots={ship.slots.optional} />
        <CapacityRow label="Hardpoints" slots={ship.slots.hardpoints} />
        <CapacityRow label="Utility" slots={ship.slots.utilities} />
      </div>

      <div className="catalogue-actions">
        <CommandTile details={false} label="Compare" />
        <CommandTile details={false} label="Shipyards" />
      </div>
    </aside>
  )
}

function DossierSlotRow({ label, slots }: { label: string, slots: Array<{ size: number }> }) {
  return (
    <section>
      <header>
        <h3>{label}</h3>
        <small>{slots.length}</small>
      </header>
      <ol>
        {slots.map((slot, index) => (
          <li data-size={slot.size} key={`${label}-${index}`}>S{slot.size}</li>
        ))}
      </ol>
    </section>
  )
}

function ShipDossier({ ship, onClose }: { ship: Ship, onClose: () => void }) {
  const slotCount = Object.values(ship.slots).reduce((count, slots) => count + slots.length, 0)

  return (
    <aside className="ship-dossier" aria-label={`${ship.displayName} dossier`}>
      <header>
        <div>
          <h2>{ship.displayName}</h2>
          <p>{ship.manufacturer ?? 'Unknown manufacturer'} · {ship.landingPadSize ?? 'unknown'} pad</p>
        </div>
        <button aria-label="Close ship dossier" onClick={onClose}>×</button>
      </header>

      <div className="dossier-actions">
        <CommandTile details={false} label="Compare" />
        <CommandTile details={false} label="Find shipyards" />
      </div>

      <dl className="dossier-specs">
        <div><dt>Armour</dt><dd>{valueOrDash(ship.performance.baseArmour)}</dd></div>
        <div><dt>Shield</dt><dd>{valueOrDash(ship.performance.baseShieldStrength)}</dd></div>
        <div><dt>Speed</dt><dd>{valueOrDash(ship.performance.speed)}</dd></div>
        <div><dt>Boost</dt><dd>{valueOrDash(ship.performance.boost)}</dd></div>
        <div><dt>Mass</dt><dd>{valueOrDash(ship.performance.hullMass, ' t')}</dd></div>
        <div><dt>Positions</dt><dd>{slotCount}</dd></div>
      </dl>

      <div className="dossier-capacity">
        <DossierSlotRow label="Core" slots={ship.slots.core} />
        <DossierSlotRow label="Optional" slots={ship.slots.optional} />
        <DossierSlotRow label="Hardpoints" slots={ship.slots.hardpoints} />
        <DossierSlotRow label="Utilities" slots={ship.slots.utilities} />
      </div>
    </aside>
  )
}

export function ShipCatalogueDossierPage() {
  const initialShip = ships.find((ship) => ship.displayName === 'Caspian Explorer') ?? ships[0]
  const [selected, setSelected] = useState<Ship | null>(initialShip)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<DossierSortKey>('displayName')
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleShips = ships
    .filter((ship) => !normalizedQuery || [ship.displayName, ship.manufacturer, ship.landingPadSize]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)))
    .sort((left, right) => {
      const leftValue = left[sortKey] ?? ''
      const rightValue = right[sortKey] ?? ''
      const comparison = leftValue.localeCompare(rightValue)
      return sortDirection === 'ascending' ? comparison : -comparison
    })

  function changeSort(nextKey: DossierSortKey) {
    if (nextKey === sortKey) {
      setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending')
      return
    }

    setSortKey(nextKey)
    setSortDirection('ascending')
  }

  function sortState(key: DossierSortKey) {
    return sortKey === key ? sortDirection : 'none'
  }

  return (
    <PageFrame layout="fit">
      <div className="ship-catalogue dossier-view">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Ship catalogue' }]} />}
          title="Ship catalogue"
        />
        <div className={['catalogue-dossier', selected && 'open'].filter(Boolean).join(' ')}>
          <section className="dossier-index" aria-label="Known ship hulls">
            <div className="dossier-filter">
              <label>
                <span className="sr-only">Filter hulls</span>
                <TextInput
                  type="search"
                  value={query}
                  placeholder="Filter hull, manufacturer or pad…"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <small>{visibleShips.length} / {ships.length}</small>
            </div>
            <div className="table-region">
              <table>
                <thead>
                  <tr>
                    <th scope="col" aria-sort={sortState('displayName')}><button onClick={() => changeSort('displayName')}>Hull</button></th>
                    <th scope="col" aria-sort={sortState('manufacturer')}><button onClick={() => changeSort('manufacturer')}>Manufacturer</button></th>
                    <th scope="col" aria-sort={sortState('landingPadSize')}><button onClick={() => changeSort('landingPadSize')}>Pad</button></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleShips.map((ship) => (
                    <tr
                      className={selected?.id === ship.id ? 'active' : undefined}
                      aria-selected={selected?.id === ship.id}
                      tabIndex={0}
                      key={ship.id}
                      onClick={() => setSelected(ship)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelected(ship)
                        }
                      }}
                    >
                      <th scope="row">{ship.displayName}</th>
                      <td>{ship.manufacturer ?? '—'}</td>
                      <td>{ship.landingPadSize ?? '—'}</td>
                    </tr>
                  ))}
                  {visibleShips.length === 0 && (
                    <tr><td className="empty-result" colSpan={3}>No matching hulls</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {selected && <ShipDossier ship={selected} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </PageFrame>
  )
}

export function ShipCatalogueSplitPage() {
  const [selected, setSelected] = useState<Ship | null>(ships[0])
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('displayName')
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleShips = ships
    .filter((ship) => !normalizedQuery || [ship.displayName, ship.manufacturer]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)))
    .sort((left, right) => {
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
    <PageFrame layout="fit">
      <div className="ship-catalogue split-view">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Ship catalogue' }]} />}
          title="Ship catalogue"
        />
        <div className={['catalogue-split', selected && 'open'].filter(Boolean).join(' ')}>
          <div className="catalogue-table-view">
            <div className="catalogue-table-toolbar">
              <label>
                <span className="sr-only">Filter hulls</span>
                <TextInput
                  type="search"
                  value={query}
                  placeholder="Filter hull or manufacturer…"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <small>{visibleShips.length} / {ships.length}</small>
            </div>
            <DataTable density="compact" label="Known ship hulls" minimum="wide">
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
                </tr>
              </thead>
              <tbody>
                {visibleShips.map((ship) => (
                  <tr
                    className={selected?.id === ship.id ? 'active' : undefined}
                    aria-selected={selected?.id === ship.id}
                    tabIndex={0}
                    key={ship.id}
                    onClick={() => setSelected(ship)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelected(ship)
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
                  </tr>
                ))}
                {visibleShips.length === 0 && (
                  <tr>
                    <td className="empty-result" colSpan={8}>No matching hulls</td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </div>
          {selected && <ShipDetailsPanel ship={selected} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </PageFrame>
  )
}
