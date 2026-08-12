import { useEffect, useMemo, useState } from 'react'
import type {
  CargoItem,
  CurrentShip,
  HealthResponse,
  MicroResourceInventory,
  MicroResource,
  RuntimeState,
  ShipDefinition,
  ShipModule,
  ShipModuleSlotGroup
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type CurrentShipView = 'status' | 'modules' | 'cargo'
export type FleetView = 'overview' | CurrentShipView | 'carriers' | 'stored-modules' | 'catalogue'
export type ShipView = FleetView

const navigation: NavigationItem[] = [
  { href: '#/fleet/overview', icon: '◇', id: 'overview', label: 'Overview' },
  { href: '#/fleet/ships/current/overview', icon: '⬡', id: 'ships', label: 'Ships' },
  { href: '#/fleet/carriers', icon: '▤', id: 'carriers', label: 'Carriers' },
  { href: '#/fleet/stored-modules', icon: '⌁', id: 'stored-modules', label: 'Stored modules' },
  { href: '#/fleet/catalogue', icon: '◎', id: 'catalogue', label: 'Ship catalogue' }
]

const currentShipNavigation: Array<{ href: string, id: CurrentShipView, label: string }> = [
  { href: '#/fleet/ships/current/overview', id: 'status', label: 'Overview' },
  { href: '#/fleet/ships/current/loadout', id: 'modules', label: 'Loadout' },
  { href: '#/fleet/ships/current/cargo', id: 'cargo', label: 'Cargo' }
]

const moduleGroups: Array<{ group: ShipModuleSlotGroup, title: string }> = [
  { group: 'core', title: 'Core internals' },
  { group: 'hardpoint', title: 'Hardpoints' },
  { group: 'utility', title: 'Utility mounts' },
  { group: 'optional', title: 'Optional internals' },
  { group: 'ship', title: 'Ship equipment' },
  { group: 'other', title: 'Other equipment' }
]

export interface ShipPageProps {
  api: PhoenixApi
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
  view: ShipView
}

export function ShipPage ({ api, error, health, runtimeState, view }: ShipPageProps) {
  const [catalogue, setCatalogue] = useState<ShipDefinition[]>()
  const [catalogueError, setCatalogueError] = useState<string>()
  const ship = runtimeState?.ship
  const currentShip = view === 'status' || view === 'modules' || view === 'cargo'
  const identity = currentShip ? shipIdentity(ship) : fleetIdentity(view)
  const page = pageIdentity(view)

  useEffect(() => {
    if (view !== 'catalogue' || catalogue !== undefined) return
    let active = true
    void api.getShipCatalogue()
      .then(response => {
        if (active) setCatalogue(response.ships)
      })
      .catch(cause => {
        if (active) setCatalogueError(cause instanceof Error ? cause.message : 'Ship catalogue unavailable.')
      })
    return () => { active = false }
  }, [api, catalogue, view])

  return (
    <PhoenixShell
      activePrimaryItemId="fleet"
      activeSecondaryItemId={currentShip ? 'ships' : view}
      error={error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="ship-page">
        <PageHeader
          title={identity.name}
          eyebrow={page.eyebrow}
          description={identity.description}
        />
        {currentShip && (
          <nav className="entity-navigation" aria-label="Current ship views">
            <span>Fleet / Current ship</span>
            <ul>
              {currentShipNavigation.map(item => (
                <li key={item.id}>
                  <a aria-current={view === item.id ? 'page' : undefined} href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <PageContent>
          {!runtimeState
            ? <p className="ship-empty">Waiting for ship telemetry…</p>
            : view === 'overview'
              ? <FleetOverview state={runtimeState} />
              : view === 'status'
              ? <ShipStatus state={runtimeState} />
              : view === 'modules'
                ? <ShipModules ship={runtimeState.ship} />
                : view === 'cargo'
                  ? <ShipCargo state={runtimeState} />
                  : view === 'catalogue'
                    ? <ShipCatalogue ships={catalogue} error={catalogueError} />
                    : <FleetPlaceholder view={view} />}
        </PageContent>
        <PageFooter>
          <span>{page.footer}</span>
          <span>{runtimeState?.updatedAt ? `Telemetry ${formatDateTime(runtimeState.updatedAt)}` : 'Telemetry pending'}</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function FleetOverview ({ state }: { state: RuntimeState }) {
  const ship = state.ship
  return (
    <div className="ship-status-grid">
      <ShipPanel title="Active vessel">
        <div className="ship-identity">
          <strong>{ship.definition?.displayName ?? humanize(ship.typeId) ?? 'Unknown hull'}</strong>
          <span>{ship.name ?? 'Unnamed vessel'}{ship.identifier ? ` · ${ship.identifier}` : ''}</span>
        </div>
        <a className="ship-inline-action" href="#/fleet/ships/current/overview">Open current ship</a>
      </ShipPanel>
      <ShipPanel title="Owned ships">
        <p className="ship-muted">Stored-ship reconstruction has not been implemented yet. The active vessel is known; the rest of the fleet remains explicitly unknown.</p>
      </ShipPanel>
      <ShipPanel title="Fleet carriers">
        <p className="ship-muted">Carrier data will appear after PHOENIX retains CarrierStats and related journal events.</p>
      </ShipPanel>
      <ShipPanel title="Catalogue">
        <p className="ship-muted">The local hull catalogue is available. Its browsing and nearest-stock presentation is the next Fleet data surface.</p>
        <a className="ship-inline-action" href="#/fleet/catalogue">Open ship catalogue</a>
      </ShipPanel>
    </div>
  )
}

function FleetPlaceholder ({ view }: { view: Exclude<FleetView, 'overview' | CurrentShipView | 'catalogue'> }) {
  const definitions = {
    carriers: ['Fleet carriers', 'CarrierStats and carrier movement events will become the retained local authority for this surface.'],
    'stored-modules': ['Stored modules', 'Stored module snapshots have not been reconstructed yet.']
  } as const
  const definition = definitions[view]
  return (
    <section className="content-section fleet-placeholder">
      <h2 className="section-heading">{definition[0]}</h2>
      <p>{definition[1]}</p>
    </section>
  )
}

function ShipCatalogue ({ error, ships }: { error?: string, ships?: ShipDefinition[] }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!ships || needle === '') return ships ?? []
    return ships.filter(ship => [ship.displayName, ship.manufacturer, ship.landingPadSize]
      .some(value => value?.toLocaleLowerCase().includes(needle)))
  }, [query, ships])
  const selected = ships?.find(ship => ship.id === selectedId) ?? filtered[0]

  if (error) return <p className="ship-warning">{error}</p>
  if (!ships) return <p className="ship-empty">Loading ship catalogue…</p>

  return (
    <div className="ship-catalogue">
      <section className="ship-catalogue__index">
        <label>
          <span>Search hulls</span>
          <input value={query} placeholder="Ship or manufacturer…" onChange={event => setQuery(event.target.value)} />
        </label>
        <ol>
          {filtered.map(ship => (
            <li key={ship.id}>
              <button
                type="button"
                aria-pressed={selected?.id === ship.id}
                onClick={() => setSelectedId(ship.id)}
              >
                <strong>{ship.displayName}</strong>
                <span>{ship.manufacturer ?? 'Unknown manufacturer'} · {ship.landingPadSize ?? 'Unknown'} pad</span>
              </button>
            </li>
          ))}
        </ol>
        {filtered.length === 0 && <p className="ship-empty">No hull matches this search.</p>}
      </section>
      <section className="ship-catalogue__detail">
        {selected
          ? <ShipDefinitionDetail ship={selected} />
          : <p className="ship-empty">Select a hull.</p>}
      </section>
    </div>
  )
}

function ShipDefinitionDetail ({ ship }: { ship: ShipDefinition }) {
  return (
    <>
      <header>
        <span>Hull definition</span>
        <h2>{ship.displayName}</h2>
        <p>{ship.manufacturer ?? 'Unknown manufacturer'} · {capitalize(ship.landingPadSize ?? 'unknown')} landing pad</p>
      </header>
      <dl className="ship-facts">
        <Fact label="Base armour" value={formatUnit(ship.performance.baseArmour, '')} />
        <Fact label="Base shield" value={formatUnit(ship.performance.baseShieldStrength, '')} />
        <Fact label="Speed" value={formatUnit(ship.performance.speed, 'm/s')} />
        <Fact label="Boost" value={formatUnit(ship.performance.boost, 'm/s')} />
        <Fact label="Hull mass" value={formatUnit(ship.performance.hullMass, 't')} />
        <Fact label="Frontier ID" value={ship.identifiers.frontierEdId?.toString()} />
      </dl>
      <div className="ship-catalogue__slots">
        <CatalogueSlotSummary label="Core internals" slots={ship.slots.core.map(slot => slot.size)} />
        <CatalogueSlotSummary label="Hardpoints" slots={ship.slots.hardpoints.map(slot => slot.size)} />
        <CatalogueSlotSummary label="Optional internals" slots={ship.slots.optional.map(slot => slot.size)} />
        <CatalogueSlotSummary label="Utility mounts" slots={ship.slots.utilities.map(slot => slot.size)} />
      </div>
      <button type="button" className="ship-catalogue__nearest" disabled title="Nearest shipyard stock query is not implemented yet.">
        Nearest shipyard selling it · Planned
      </button>
      <small className="ship-catalogue__source">Source: {ship.source.name}{ship.source.revision ? ` · ${ship.source.revision}` : ''}</small>
    </>
  )
}

function CatalogueSlotSummary ({ label, slots }: { label: string, slots: number[] }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{slots.length}</strong>
      <small>{slots.length === 0 ? 'None' : slots.map(size => `S${size}`).join(' · ')}</small>
    </div>
  )
}

function ShipStatus ({ state }: { state: RuntimeState }) {
  const { ship, gameStatus } = state
  const cargoCount = totalCargo(state.inventory.cargo?.items ?? [])
  const engineered = ship.modules.filter(module => module.engineering !== null).length
  const damaged = ship.modules.filter(module => module.health !== null && module.health < 1).length
  const fuel = gameStatus?.fuel

  return (
    <div className="ship-status-grid">
      <ShipPanel title="Vessel">
        <div className="ship-identity">
          <strong>{ship.definition?.displayName ?? humanize(ship.typeId) ?? 'Unknown hull'}</strong>
          <span>{ship.name ?? 'Unnamed vessel'}{ship.identifier ? ` · ${ship.identifier}` : ''}</span>
        </div>
        <dl className="ship-facts">
          <Fact label="Manufacturer" value={ship.definition?.manufacturer} />
          <Fact label="Landing pad" value={ship.definition?.landingPadSize && `${capitalize(ship.definition.landingPadSize)} pad`} />
          <Fact label="Hull integrity" value={formatPercent(ship.hullHealth)} />
          <Fact label="Rebuy cost" value={formatCredits(ship.rebuy)} />
          <Fact label="Hull value" value={formatCredits(ship.hullValue)} />
          <Fact label="Modules value" value={formatCredits(ship.modulesValue)} />
        </dl>
      </ShipPanel>

      <ShipPanel title="Performance">
        <div className="ship-metrics">
          <Metric label="Jump range" value={formatUnit(ship.maxJumpRange, 'ly', 1)} />
          <Metric label="Unladen mass" value={formatUnit(ship.unladenMass, 't', 1)} />
          <Metric label="Cargo" value={`${cargoCount} / ${formatNumber(ship.cargoCapacity)}`} />
          <Metric label="Modules" value={formatNumber(ship.modules.length)} />
        </div>
        <CapacityBar label="Cargo hold" value={cargoCount} maximum={ship.cargoCapacity} />
        <CapacityBar label="Hull integrity" value={ship.hullHealth === null ? null : ship.hullHealth * 100} maximum={100} />
      </ShipPanel>

      <ShipPanel title="Live status">
        <div className="ship-switches">
          <StatusTag active={gameStatus?.flags.shieldsUp} label="Shields" />
          <StatusTag active={gameStatus?.flags.hardpointsDeployed} label="Hardpoints" />
          <StatusTag active={gameStatus?.flags.landingGearDown} label="Landing gear" />
          <StatusTag active={gameStatus?.flags.cargoScoopDeployed} label="Cargo scoop" />
          <StatusTag active={gameStatus?.flags.lightsOn} label="Lights" />
          <StatusTag active={gameStatus?.flags.nightVision} label="Night vision" />
          <StatusTag active={gameStatus?.flags.flightAssistOff} label="Flight assist off" warning />
          <StatusTag active={gameStatus?.flags.silentRunning} label="Silent running" warning />
        </div>
        <dl className="ship-facts ship-facts--compact">
          <Fact label="Legal state" value={gameStatus?.legalState} />
          <Fact label="Fire group" value={gameStatus?.fireGroup === null || gameStatus?.fireGroup === undefined ? null : `${gameStatus.fireGroup + 1}`} />
          <Fact label="Selected weapon" value={gameStatus?.selectedWeapon} />
          <Fact label="GUI focus" value={gameStatus?.guiFocus?.label} />
        </dl>
      </ShipPanel>

      <ShipPanel title="Power and stores">
        <div className="ship-metrics">
          <Metric label="Systems" value={formatPips(gameStatus?.pips?.systems)} />
          <Metric label="Engines" value={formatPips(gameStatus?.pips?.engines)} />
          <Metric label="Weapons" value={formatPips(gameStatus?.pips?.weapons)} />
          <Metric label="Engineered" value={formatNumber(engineered)} />
        </div>
        <CapacityBar label="Main fuel" value={fuel?.main ?? null} maximum={ship.fuelCapacity?.main ?? null} />
        <CapacityBar label="Reservoir" value={fuel?.reservoir ?? null} maximum={ship.fuelCapacity?.reserve ?? null} />
        <p className={damaged > 0 ? 'ship-warning' : 'ship-clear'}>
          {damaged > 0 ? `${damaged} ${damaged === 1 ? 'module reports' : 'modules report'} damage.` : 'No module damage reported.'}
        </p>
      </ShipPanel>
    </div>
  )
}

function ShipModules ({ ship }: { ship: CurrentShip }) {
  if (ship.modules.length === 0) return <p className="ship-empty">No loadout telemetry available.</p>
  return (
    <div className="ship-sections">
      {moduleGroups.map(({ group, title }) => {
        const modules = ship.modules.filter(module => module.slotGroup === group)
        if (modules.length === 0) return null
        return (
          <section className="content-section" key={group}>
            <h2 className="section-heading">{title}</h2>
            <table className="data-table ship-modules-table">
              <thead><tr><th>Slot</th><th>Module</th><th>Engineering</th><th>Condition</th></tr></thead>
              <tbody>{modules.map(module => <ModuleRow key={module.slotId} module={module} />)}</tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}

function ModuleRow ({ module }: { module: ShipModule }) {
  const condition = module.health === null ? '—' : formatPercent(module.health)
  const damaged = module.health !== null && module.health < 1
  return (
    <tr className={damaged ? 'is-damaged' : undefined}>
      <td>
        <strong>{module.expectedSlot?.name ?? humanize(module.slotId) ?? module.slotId}</strong>
        <small>{slotDescription(module)}</small>
      </td>
      <td>
        <strong>{module.definition?.displayName ?? humanize(module.moduleId) ?? module.moduleId}</strong>
        <small>{moduleCode(module)}{module.definition?.mount ? ` · ${module.definition.mount}` : ''}</small>
      </td>
      <td>
        {module.engineering
          ? <><strong>{module.engineering.blueprintName ?? 'Engineered'}{module.engineering.level ? ` G${module.engineering.level}` : ''}</strong><small>{module.engineering.experimentalEffectLabel ?? module.engineering.experimentalEffect ?? module.engineering.engineer ?? 'No experimental effect'}</small></>
          : <span className="ship-muted">Standard</span>}
      </td>
      <td className="align-right">
        <strong className={damaged ? 'ship-danger' : undefined}>{condition}</strong>
        <small>{module.enabled === false ? 'Disabled' : module.enabled === true ? `Enabled · Priority ${module.priority ?? '—'}` : `Priority ${module.priority ?? '—'}`}</small>
      </td>
    </tr>
  )
}

function ShipCargo ({ state }: { state: RuntimeState }) {
  const cargo = state.inventory.cargo
  const items = cargo?.items ?? []
  const count = totalCargo(items)
  return (
    <div className="ship-sections">
      <section className="ship-manifest-summary">
        <div><span>Loaded</span><strong>{count} t</strong></div>
        <div><span>Capacity</span><strong>{formatUnit(state.ship.cargoCapacity, 't')}</strong></div>
        <div><span>Available</span><strong>{state.ship.cargoCapacity === null ? '—' : `${Math.max(0, state.ship.cargoCapacity - count)} t`}</strong></div>
        <div><span>Vessel</span><strong>{capitalize(cargo?.vessel ?? 'unknown')}</strong></div>
      </section>
      <CapacityBar label="Cargo hold" value={count} maximum={state.ship.cargoCapacity} />
      <section className="content-section">
        <h2 className="section-heading">Cargo manifest</h2>
        {items.length === 0
          ? <p className="ship-empty">Cargo hold is empty.</p>
          : (
              <table className="data-table ship-cargo-table">
                <thead><tr><th>Commodity</th><th>Quantity</th><th>Mission</th><th>Stolen</th></tr></thead>
                <tbody>{items.map(item => (
                  <tr key={`${item.id}:${item.missionId ?? 'general'}`}>
                    <td><strong>{item.label ?? humanize(item.id) ?? item.id}</strong><small>{item.id}</small></td>
                    <td>{item.count} t</td>
                    <td>{item.missionId ? `Mission ${item.missionId}` : '—'}</td>
                    <td className={item.stolen > 0 ? 'ship-danger' : undefined}>{item.stolen > 0 ? `${item.stolen} t` : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
      </section>
    </div>
  )
}

export function CommanderInventory ({ state }: { state: RuntimeState }) {
  return (
    <div className="ship-sections">
      <ResourceStore title="Ship locker" inventory={state.inventory.shipLocker} />
      <ResourceStore title="Backpack" inventory={state.inventory.backpack} />
    </div>
  )
}

function ResourceStore ({ inventory, title }: { inventory: MicroResourceInventory | null, title: string }) {
  if (!inventory) {
    return <section className="content-section"><h2 className="section-heading">{title}</h2><p className="ship-empty">No inventory snapshot available.</p></section>
  }
  const groups: Array<{ label: string, items: MicroResource[] }> = [
    { label: 'Items', items: inventory.items },
    { label: 'Components', items: inventory.components },
    { label: 'Consumables', items: inventory.consumables },
    { label: 'Data', items: inventory.data }
  ]
  const total = groups.reduce((sum, group) => sum + group.items.reduce((count, item) => count + item.count, 0), 0)
  return (
    <section className="content-section ship-resource-store">
      <h2 className="section-heading">{title}<span>{total} units · {formatDateTime(inventory.updatedAt)}</span></h2>
      <div className="ship-inventory-grid">
        {groups.map(group => (
          <section key={group.label}>
            <h3>{group.label}<span>{group.items.reduce((sum, item) => sum + item.count, 0)}</span></h3>
            {group.items.length === 0
              ? <p className="ship-empty">None</p>
              : <table className="data-table"><tbody>{group.items.map(item => <ResourceRow key={resourceKey(item)} item={item} />)}</tbody></table>}
          </section>
        ))}
      </div>
    </section>
  )
}

function ResourceRow ({ item }: { item: MicroResource }) {
  return (
    <tr>
      <td><strong>{item.label ?? humanize(item.id) ?? item.id}</strong><small>{item.id}</small></td>
      <td className="align-right"><strong>{item.count}</strong><small>{item.missionId ? 'Mission' : item.ownerId ? `Owner ${item.ownerId}` : 'Stored'}</small></td>
    </tr>
  )
}

function ShipPanel ({ children, title }: { children: React.ReactNode, title: string }) {
  return <section className="ship-panel"><h2>{title}</h2><div>{children}</div></section>
}

function Fact ({ label, value }: { label: string, value?: string | null }) {
  return <><dt>{label}</dt><dd>{value || '—'}</dd></>
}

function Metric ({ label, value }: { label: string, value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function StatusTag ({ active, label, warning = false }: { active?: boolean, label: string, warning?: boolean }) {
  return <span className={active ? warning ? 'is-warning' : 'is-active' : undefined}>{label}</span>
}

function CapacityBar ({ label, maximum, value }: { label: string, maximum: number | null | undefined, value: number | null }) {
  const valid = value !== null && maximum !== null && maximum !== undefined && maximum > 0
  return (
    <div className="ship-capacity">
      <div><span>{label}</span><span>{valid ? `${formatNumber(value)} / ${formatNumber(maximum)}` : '—'}</span></div>
      <progress value={valid ? value : 0} max={valid ? maximum : 1} />
    </div>
  )
}

function pageIdentity (view: ShipView) {
  if (view === 'overview') return { eyebrow: 'Owned vessels and assets', footer: 'Fleet overview' }
  if (view === 'modules') return { eyebrow: 'Installed loadout', footer: 'Module telemetry' }
  if (view === 'cargo') return { eyebrow: 'Cargo manifest', footer: 'Cargo telemetry' }
  if (view === 'carriers') return { eyebrow: 'Capital assets', footer: 'Carrier records' }
  if (view === 'stored-modules') return { eyebrow: 'Stored equipment', footer: 'Module storage' }
  if (view === 'catalogue') return { eyebrow: 'Known ship hulls', footer: 'Ship database' }
  return { eyebrow: 'Ship status', footer: 'Live vessel telemetry' }
}

function fleetIdentity (view: Exclude<FleetView, CurrentShipView>) {
  const identities = {
    overview: { name: 'Fleet', description: 'Owned ships, carriers, stored equipment, and the ship catalogue.' },
    carriers: { name: 'Fleet Carriers', description: 'Owned carrier status and movement reconstructed from local events.' },
    'stored-modules': { name: 'Stored Modules', description: 'Equipment retained outside the current ship.' },
    catalogue: { name: 'Ship Catalogue', description: 'Known hull specifications and reported shipyard availability.' }
  } as const
  return identities[view]
}

function shipIdentity (ship?: CurrentShip) {
  const name = ship?.name ?? ship?.definition?.displayName ?? humanize(ship?.typeId) ?? 'Current ship'
  const hull = ship?.definition?.displayName ?? humanize(ship?.typeId)
  const details = [ship?.identifier, hull && hull !== name ? hull : null, ship?.definition?.manufacturer].filter(Boolean)
  return { name, description: details.join(' · ') || 'Waiting for a ship loadout snapshot.' }
}

function slotDescription (module: ShipModule): string {
  return `Slot ${module.slotId} · Size ${module.slotSize ?? module.expectedSlot?.size ?? '—'}`
}

function moduleCode (module: ShipModule): string {
  const size = module.moduleSize ?? module.definition?.size
  const rating = module.definition?.rating ?? module.moduleClass
  return size === null || size === undefined ? 'Size unknown' : `${size}${rating ?? ''}`
}

function totalCargo (items: CargoItem[]): number {
  return items.reduce((total, item) => total + item.count, 0)
}

function resourceKey (item: MicroResource): string {
  return `${item.id}:${item.ownerId ?? 'commander'}:${item.missionId ?? 'general'}`
}

function humanize (value?: string | null): string | null {
  if (!value) return null
  return value
    .replace(/^\$|_name;$/gu, '')
    .replace(/[_.$-]+/gu, ' ')
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/\b\w/gu, letter => letter.toUpperCase())
}

function capitalize (value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/gu, ' ')
}

function formatPercent (value?: number | null): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
}

function formatNumber (value?: number | null): string {
  return value === null || value === undefined ? '—' : new Intl.NumberFormat().format(value)
}

function formatUnit (value: number | null | undefined, unit: string, digits = 0): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(digits)} ${unit}`
}

function formatCredits (value?: number | null): string {
  return value === null || value === undefined ? '—' : `${new Intl.NumberFormat().format(Math.round(value))} CR`
}

function formatPips (value?: number): string {
  return value === undefined ? '—' : `${(value / 2).toFixed(value % 2 === 0 ? 0 : 1)} pips`
}

function formatDateTime (timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp))
}
