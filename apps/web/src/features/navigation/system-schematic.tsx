import type { FormEvent, MouseEvent, ReactNode } from 'react'
import type {
  CartographicBody,
  CartographicStation,
  CartographicSystem
} from '@phoenix/contracts'
import {
  buildSystemHierarchy,
  type AttachedInstallation,
  type BodyHierarchyNode
} from './system-hierarchy.js'
import './system-schematic.css'

export type CartographicSelection = CartographicBody | CartographicStation

export interface SystemSchematicProps {
  onQueryChange(value: string): void
  onSearch(): void
  onSelect(name?: string): void
  query: string
  selected?: CartographicSelection | null
  system: CartographicSystem
}

export function SystemSchematic ({ onQueryChange, onSearch, onSelect, query, selected, system }: SystemSchematicProps) {
  const hierarchy = buildSystemHierarchy(system)

  return (
    <div className={selected ? 'system-cartography has-selection' : 'system-cartography'}>
      <section className="system-schematic" aria-label={`Schematic map of ${system.name}`}>
        <header className="system-schematic__header">
          <form
            className="system-schematic__search"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              onSearch()
            }}
          >
            <span>System schematic</span>
            <label>
              <span className="visually-hidden">System name</span>
              <input
                aria-label="System name"
                onChange={event => onQueryChange(event.target.value)}
                spellCheck="false"
                value={query}
              />
              <button aria-label="Load system" title="Load system" type="submit">⌕</button>
            </label>
          </form>
          <dl>
            <div><dt>Known</dt><dd>{system.scanProgress.knownBodies}</dd></div>
            <div><dt>Reported</dt><dd>{system.scanProgress.reportedBodies ?? '—'}</dd></div>
            <div><dt>Mapped</dt><dd>{system.scanProgress.percent == null ? '—' : `${system.scanProgress.percent}%`}</dd></div>
          </dl>
        </header>

        <div
          className="system-schematic__viewport"
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (!(event.target instanceof Element) || !event.target.closest('button')) onSelect()
          }}
        >
          {hierarchy.roots.map(root => (
            <OrbitalGroupView
              key={bodyKey(root.body)}
              onSelect={onSelect}
              root={root}
              selectedName={selected?.name}
            />
          ))}
          {hierarchy.roots.length === 0 && hierarchy.unassignedInstallations.length === 0 && (
            <p className="system-schematic__empty">No body catalogue is available for this system.</p>
          )}
          {hierarchy.unassignedInstallations.length > 0 && (
            <section className="system-orbit-group system-orbit-group--ungrouped">
              <div className="system-orbit-group__title">
                <span>Unresolved installations</span>
                <strong>{hierarchy.unassignedInstallations.length} objects</strong>
              </div>
              <div className="system-unassigned-installations">
                {hierarchy.unassignedInstallations.map(station => (
                  <InstallationNode
                    installation={{ source: 'distance', station }}
                    key={stationKey(station)}
                    onSelect={onSelect}
                    selected={selected?.name === station.name}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <SystemSummary system={system} />
      </section>

      {selected && <CartographyDetail selection={selected} />}
    </div>
  )
}

function OrbitalGroupView ({
  onSelect,
  root,
  selectedName
}: {
  root: BodyHierarchyNode
  onSelect(name: string): void
  selectedName?: string
}) {
  return (
    <section className="system-orbit-group">
      <div className="system-orbit-group__title">
        <span>{root.body.name}</span>
        <strong>{root.body.subType ?? root.body.type ?? 'Celestial body'}</strong>
      </div>
      <div className="system-orbit-row">
        <BodyNode node={root} onSelect={onSelect} selectedName={selectedName} star />
        <div className="system-orbit-row__line" aria-hidden="true" />
        {root.children.map(child => (
          <BodyBranchView key={bodyKey(child.body)} node={child} onSelect={onSelect} selectedName={selectedName} />
        ))}
      </div>
    </section>
  )
}

function BodyBranchView ({
  child = false,
  node,
  onSelect,
  selectedName
}: {
  child?: boolean
  node: BodyHierarchyNode
  onSelect(name: string): void
  selectedName?: string
}) {
  return (
    <div className="system-body-branch">
      <BodyNode child={child} node={node} onSelect={onSelect} selectedName={selectedName} />
      {node.children.length > 0 && (
        <div className="system-body-branch__children">
          {node.children.map(descendant => (
            <BodyBranchView
              child
              key={bodyKey(descendant.body)}
              node={descendant}
              onSelect={onSelect}
              selectedName={selectedName}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BodyNode ({
  child = false,
  node,
  onSelect,
  selectedName,
  star = false
}: {
  child?: boolean
  node: BodyHierarchyNode
  onSelect(name: string): void
  selectedName?: string
  star?: boolean
}) {
  const { body, installations } = node
  const kind = bodyKind(body)
  const signals = body.local?.signals
  return (
    <div className="system-body-node">
      <button
        aria-label={`${body.name}, ${body.subType ?? body.type ?? 'unknown body'}`}
        className={[
          'system-body',
          `system-body--${kind}`,
          star ? 'system-body--star' : '',
          child ? 'system-body--child' : '',
          selectedName === body.name ? 'is-selected' : ''
        ].filter(Boolean).join(' ')}
        onClick={() => onSelect(body.name)}
        type="button"
      >
        <span className="system-body__distance">{formatDistance(body.distanceToArrival)}</span>
        <BodyGlyph kind={kind} ringed={isRinged(body)} />
        <strong>{shortBodyName(body.name)}</strong>
        <small>{shortType(body)}</small>
        <span className="system-body__badges">
          {body.local?.mapped && <i title="Mapped">M</i>}
          {body.local?.surfaceScanCompleted && <i title="Surface scan complete">S</i>}
          {signals && signals.biological > 0 && <i className="is-signal" title="Biological signals">B{signals.biological}</i>}
          {signals && signals.geological > 0 && <i className="is-signal" title="Geological signals">G{signals.geological}</i>}
        </span>
      </button>
      {installations.length > 0 && (
        <div className="system-body-installations">
          {installations.map(installation => (
            <InstallationNode
              installation={installation}
              key={stationKey(installation.station)}
              onSelect={onSelect}
              selected={selectedName === installation.station.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InstallationNode ({
  installation,
  onSelect,
  selected
}: {
  installation: AttachedInstallation
  onSelect(name: string): void
  selected: boolean
}) {
  const { source, station } = installation
  return (
    <button
      className={`system-installation${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(station.name)}
      title={`${station.type ?? 'Installation'} · parent ${source === 'explicit' ? 'reported' : 'inferred'}`}
      type="button"
    >
      <StationGlyph />
      <span><strong>{station.name}</strong><small>{station.type ?? 'Installation'}</small></span>
    </button>
  )
}

function SystemSummary ({ system }: { system: CartographicSystem }) {
  const info = system.information
  return (
    <footer className="system-summary">
      <strong>System summary</strong>
      <dl>
        <div><dt>Bodies</dt><dd>{system.bodies.length}</dd></div>
        <div><dt>Installations</dt><dd>{system.stations.length}</dd></div>
        <div><dt>Economy</dt><dd>{info.primaryEconomy ?? '—'}</dd></div>
        <div><dt>Population</dt><dd>{formatNumber(info.population)}</dd></div>
        <div><dt>Allegiance</dt><dd>{info.allegiance ?? '—'}</dd></div>
        <div><dt>Security</dt><dd>{info.security ?? '—'}</dd></div>
      </dl>
    </footer>
  )
}

function BodyGlyph ({ kind, ringed }: { kind: BodyKind, ringed: boolean }) {
  return (
    <svg className="system-body__glyph" viewBox="0 0 100 100" aria-hidden="true">
      {ringed && <ellipse className="body-glyph__ring" cx="50" cy="52" rx="47" ry="15" />}
      {kind === 'belt'
        ? <BeltGlyph />
        : kind === 'black-hole'
          ? <BlackHoleGlyph />
          : (
              <>
                <circle className="body-glyph__disc" cx="50" cy="50" r={kind === 'star' ? 34 : 29} />
                {kind === 'star' && <StarGlyph />}
                {kind === 'gas' && <GasGlyph />}
                {kind === 'ice' && <IceGlyph />}
                {kind === 'earthlike' && <EarthlikeGlyph />}
                {kind === 'rocky' && <RockyGlyph />}
                {kind === 'exotic' && <ExoticGlyph />}
              </>
            )}
    </svg>
  )
}

function StarGlyph () {
  return <g className="body-glyph__detail"><circle cx="50" cy="50" r="23" /><path d="M50 10v8M50 82v8M10 50h8M82 50h8M22 22l6 6M72 72l6 6M78 22l-6 6M28 72l-6 6" /></g>
}

function GasGlyph () {
  return <g className="body-glyph__detail"><path d="M23 38c17 6 37 6 54 0M21 49c19 6 39 6 58 0M23 61c17-5 37-5 54 0" /><ellipse cx="62" cy="49" rx="8" ry="4" /></g>
}

function RockyGlyph () {
  return <g className="body-glyph__detail"><path d="M29 31l13 8-6 12 11 14M60 25l-7 14 14 8-10 17M27 63l13-6M61 66l10-8" /></g>
}

function IceGlyph () {
  return <g className="body-glyph__detail"><path d="M50 22v56M24 42l52 16M24 58l52-16M34 27l32 46M66 27L34 73" /></g>
}

function EarthlikeGlyph () {
  return <g className="body-glyph__detail"><path d="M25 45c8-13 17-4 25-11 9-8 17 0 24 7M25 57c10-7 15 5 26 1 10-4 13 5 23 0" /><path d="M38 27c4 7 2 14-4 19M62 72c-5-7-3-13 4-19" /></g>
}

function ExoticGlyph () {
  return <g className="body-glyph__detail"><path d="M50 21l8 20 21 9-21 9-8 20-8-20-21-9 21-9z" /><circle cx="50" cy="50" r="8" /></g>
}

function BeltGlyph () {
  return <g className="body-glyph__detail body-glyph__asteroids"><ellipse cx="50" cy="50" rx="37" ry="15" /><circle cx="22" cy="47" r="4" /><circle cx="35" cy="39" r="3" /><circle cx="49" cy="36" r="4" /><circle cx="63" cy="40" r="3" /><circle cx="78" cy="48" r="4" /><circle cx="62" cy="60" r="4" /><circle cx="42" cy="64" r="3" /><circle cx="27" cy="57" r="3" /></g>
}

function BlackHoleGlyph () {
  return <g className="body-glyph__detail body-glyph__black-hole"><ellipse cx="50" cy="50" rx="43" ry="16" /><circle cx="50" cy="50" r="24" /><circle cx="50" cy="50" r="13" /></g>
}

function StationGlyph () {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 5h22v22H5zM10 10h12v12H10zM2 16h7M23 16h7M16 2v7M16 23v7" /></svg>
}

function CartographyDetail ({ selection }: { selection: CartographicSelection }) {
  if (isStation(selection)) return <StationDetail station={selection} />
  return <BodyDetail body={selection} />
}

function BodyDetail ({ body }: { body: CartographicBody }) {
  const raw = body.raw
  const signals = body.local?.signals
  return (
    <aside className="cartography-detail">
      <header className="cartography-detail__body">
        <BodyGlyph kind={bodyKind(body)} ringed={isRinged(body)} />
        <div><span>Body</span><h2>{body.name}</h2><p>{body.subType ?? body.type ?? 'Unclassified'}</p></div>
      </header>
      <DetailSection title="Navigation">
        <Fact label="Arrival" value={formatDistance(body.distanceToArrival)} />
        <Fact label="Landable" value={booleanLabel(raw.landable ?? raw.isLandable)} />
        <Fact label="Mapped" value={booleanLabel(body.local?.mapped)} />
        <Fact label="Discovered" value={booleanLabel(body.local?.discovered)} />
      </DetailSection>
      <DetailSection title="Environment">
        <Fact label="Gravity" value={formatUnit(numberValue(raw.surfaceGravity ?? raw.gravity), 'g', 2)} />
        <Fact label="Temperature" value={formatUnit(numberValue(raw.surfaceTemperature ?? raw.temperature), ' K', 0)} />
        <Fact label="Radius" value={formatUnit(numberValue(raw.radius), ' km', 0)} />
        <Fact label="Atmosphere" value={textValue(raw.atmosphereType ?? raw.atmosphere)} />
      </DetailSection>
      {signals && (signals.biological + signals.geological + signals.human > 0) && (
        <DetailSection title="Signals">
          <Fact label="Biological" value={String(signals.biological)} />
          <Fact label="Geological" value={String(signals.geological)} />
          <Fact label="Human" value={String(signals.human)} />
        </DetailSection>
      )}
      {body.local?.biologicalGenuses.length ? (
        <DetailSection title="Biological genera"><TagList values={body.local.biologicalGenuses} /></DetailSection>
      ) : null}
    </aside>
  )
}

function StationDetail ({ station }: { station: CartographicStation }) {
  return (
    <aside className="cartography-detail">
      <header className="cartography-detail__station"><StationGlyph /><div><span>Installation</span><h2>{station.name}</h2><p>{station.type ?? 'Station'}</p></div></header>
      <DetailSection title="Navigation"><Fact label="Arrival" value={formatDistance(station.distanceToArrival)} /><Fact label="Allegiance" value={station.allegiance} /><Fact label="Government" value={station.government} /></DetailSection>
      <DetailSection title="Economy"><Fact label="Primary" value={station.economy} /><Fact label="Secondary" value={station.secondEconomy} /><Fact label="Faction" value={station.controllingFaction} /></DetailSection>
      <DetailSection title="Facilities"><TagList values={[
        ...(station.facilities.market ? ['Market'] : []),
        ...(station.facilities.shipyard ? ['Shipyard'] : []),
        ...(station.facilities.outfitting ? ['Outfitting'] : []),
        ...station.services
      ]} /></DetailSection>
    </aside>
  )
}

function DetailSection ({ children, title }: { children: ReactNode, title: string }) {
  return <section><h3>{title}</h3><dl>{children}</dl></section>
}

function Fact ({ label, value }: { label: string, value?: string | null }) {
  return <div><dt>{label}</dt><dd>{value || '—'}</dd></div>
}

function TagList ({ values }: { values: string[] }) {
  const unique = [...new Set(values)].filter(Boolean)
  return unique.length ? <div className="cartography-tags">{unique.map(value => <span key={value}>{value}</span>)}</div> : <p>None reported</p>
}

type BodyKind = 'star' | 'gas' | 'rocky' | 'ice' | 'earthlike' | 'belt' | 'black-hole' | 'exotic'

function bodyKind (body: CartographicBody): BodyKind {
  const type = `${body.name} ${body.type ?? ''} ${body.subType ?? ''}`.toLocaleLowerCase()
  if (type.includes('black hole')) return 'black-hole'
  if (type.includes('belt') || type.includes('asteroid')) return 'belt'
  if (type.includes('star')) return 'star'
  if (type.includes('gas giant') || type.includes('water giant')) return 'gas'
  if (type.includes('earth-like') || type.includes('water world') || type.includes('ammonia world')) return 'earthlike'
  if (type.includes('icy') || type.includes('ice')) return 'ice'
  if (type.includes('rock') || type.includes('metal')) return 'rocky'
  return 'exotic'
}

function isRinged (body: CartographicBody): boolean {
  const rings = body.raw.rings
  return Array.isArray(rings) && rings.length > 0
}

function isStation (selection: CartographicSelection): selection is CartographicStation {
  return 'services' in selection
}

function bodyKey (body: CartographicBody): string | number {
  return body.id64 ?? body.id ?? body.bodyId ?? body.name
}

function stationKey (station: CartographicStation): string | number {
  return station.marketId ?? station.id ?? station.name
}

function shortBodyName (name: string): string {
  const segments = name.trim().split(/\s+/u)
  return segments.length > 2 ? segments.slice(-2).join(' ') : name
}

function shortType (body: CartographicBody): string {
  return (body.subType ?? body.type ?? 'Unknown').replace(/\s+body$/iu, '')
}

function formatDistance (value: number | null): string {
  if (value == null) return '—'
  return value < 0.1 ? `${Math.round(value * 299_792)} km` : `${Math.round(value).toLocaleString()} ls`
}

function formatNumber (value: number | null): string {
  return value == null ? '—' : value.toLocaleString()
}

function numberValue (value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function textValue (value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function booleanLabel (value: unknown): string | null {
  return typeof value === 'boolean' ? value ? 'Yes' : 'No' : null
}

function formatUnit (value: number | null, unit: string, decimals: number): string | null {
  return value == null ? null : `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}${unit}`
}
