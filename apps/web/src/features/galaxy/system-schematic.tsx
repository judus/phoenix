import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import type {
  CartographicBody,
  CartographicStation,
  CartographicSystem
} from '@phoenix/contracts'
import { Button } from '@phoenix/ui'
import {
  buildSystemHierarchy,
  type AttachedInstallation,
  type BodyHierarchyNode
} from './system-hierarchy.js'
import {
  layoutSystemHierarchy,
  type OrbitalLayoutPoint,
  type SystemOrbitalLayout
} from './system-orbital-layout.js'

export type CartographicSelection = CartographicBody | CartographicStation

export interface SystemSchematicProps {
  actions?: ReactNode
  commanderName?: string | null
  onBookmarkBody?(name: string): void
  onSelect(name?: string): void
  selected?: CartographicSelection | null
  system: CartographicSystem
}

export function SystemSchematic ({ actions, commanderName, onBookmarkBody, onSelect, selected, system }: SystemSchematicProps) {
  const hierarchy = buildSystemHierarchy(system)
  const layout = layoutSystemHierarchy(hierarchy.roots)
  const viewportRef = useRef<HTMLDivElement>(null)
  const focalPointRef = useRef<{ x: number, y: number } | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const focalPoint = focalPointRef.current
    if (!viewport || !focalPoint) return
    viewport.scrollLeft = focalPoint.x * viewport.scrollWidth - viewport.clientWidth / 2
    viewport.scrollTop = focalPoint.y * viewport.scrollHeight - viewport.clientHeight / 2
    focalPointRef.current = null
  }, [zoomPercent])

  const changeZoom = (nextZoomPercent: number) => {
    const viewport = viewportRef.current
    if (viewport) {
      focalPointRef.current = {
        x: (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth,
        y: (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight
      }
    }
    setZoomPercent(Math.max(50, Math.min(200, nextZoomPercent)))
  }

  return (
    <div className={selected ? 'system-cartography has-selection' : 'system-cartography'}>
      <section className="system-schematic" aria-label={`Schematic map of ${system.name}`}>
        <div
          className="system-schematic__viewport"
          ref={viewportRef}
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (!(event.target instanceof Element) || !event.target.closest('button')) onSelect()
          }}
        >
          {layout.nodes.length > 0 && (
            <OrbitalMap
              layout={layout}
              onSelect={onSelect}
              selectedName={selected?.name}
              systemName={system.name}
              zoomPercent={zoomPercent}
            />
          )}
          {hierarchy.roots.length === 0 && hierarchy.unassignedInstallations.length === 0 && (
            <p className="system-schematic__empty">No body catalogue is available for this system.</p>
          )}
          {hierarchy.unassignedInstallations.length > 0 && (
            <section className="system-unassigned-group">
              <div className="system-unassigned-group__title">
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
        <div className="system-schematic__controls">
          {actions}
          <div className="system-schematic__zoom" aria-label="Schematic zoom controls">
            <Button
              aria-label="Zoom out"
              disabled={zoomPercent === 50}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => changeZoom(zoomPercent - 25)}
            >−</Button>
            <Button
              aria-label="Reset zoom to 100%"
              size="sm"
              title="Reset zoom"
              type="button"
              variant="quiet"
              onClick={() => changeZoom(100)}
            >{zoomPercent}%</Button>
            <Button
              aria-label="Zoom in"
              disabled={zoomPercent === 200}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => changeZoom(zoomPercent + 25)}
            >+</Button>
          </div>
        </div>

      </section>

      {selected && <CartographyDetail commanderName={commanderName} onBookmarkBody={onBookmarkBody} selection={selected} />}
      <SystemSummary system={system} />
    </div>
  )
}

function OrbitalMap ({
  layout,
  onSelect,
  selectedName,
  systemName,
  zoomPercent
}: {
  layout: SystemOrbitalLayout
  onSelect(name: string): void
  selectedName?: string
  systemName: string
  zoomPercent: number
}) {
  const scale = zoomPercent / 100
  const viewportStyle: CSSProperties = {
    blockSize: `${layout.height * 9 * scale}rem`,
    inlineSize: `${layout.width * 9 * scale}rem`
  }
  const canvasStyle: CSSProperties = {
    blockSize: `${layout.height * 9}rem`,
    inlineSize: `${layout.width * 9}rem`,
    transform: `scale(${scale})`
  }
  return (
    <div className="system-orbital-layout" style={viewportStyle}>
      <div className="system-orbital-layout__canvas" style={canvasStyle}>
        <svg
          aria-hidden="true"
          className="system-orbital-layout__connections"
          preserveAspectRatio="none"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          {layout.edges.map(edge => (
            <polyline
              key={edge.key}
              points={edge.points.map(point => `${point.x},${point.y}`).join(' ')}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {layout.nodes.map(item => (
          <div
            className={[
              'system-orbital-layout__node',
              item.compact ? 'is-compact' : '',
              item.node.kind === 'unresolved-body' ? 'is-structural' : ''
            ].filter(Boolean).join(' ')}
            key={item.node.key}
            style={layoutPosition(item, layout)}
          >
            {item.node.kind === 'body'
              ? <BodyNode
                  child={item.compact}
                  node={item.node}
                  onSelect={onSelect}
                  selectedName={selectedName}
                  systemName={systemName}
                />
              : <UnresolvedBodyNode bodyId={item.node.bodyId} bodyType={item.node.bodyType} />}
          </div>
        ))}
        {layout.installations.map(item => (
          <div className="system-orbital-layout__installation" key={item.key} style={layoutPosition(item, layout)}>
            <InstallationNode
              installation={item.installation}
              onSelect={onSelect}
              selected={selectedName === item.installation.station.name}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function UnresolvedBodyNode ({ bodyId, bodyType }: { bodyId: number, bodyType: 'Star' | 'Planet' }) {
  return (
    <div className="system-unresolved-body" title={`${bodyType} ${bodyId} has not been reported yet`}>
      <span>?</span>
      <small>{bodyType} {bodyId}</small>
    </div>
  )
}

function layoutPosition (point: OrbitalLayoutPoint, layout: SystemOrbitalLayout): CSSProperties {
  return {
    insetBlockStart: `${point.y / layout.height * 100}%`,
    insetInlineStart: `${point.x / layout.width * 100}%`
  }
}

function BodyNode ({
  child = false,
  node,
  onSelect,
  selectedName,
  systemName
}: {
  child?: boolean
  node: BodyHierarchyNode
  onSelect(name: string): void
  selectedName?: string
  systemName: string
}) {
  const { body } = node
  const kind = bodyKind(body)
  const signals = body.local?.signals
  return (
    <div className="system-body-node">
      <button
        aria-label={`${body.name}, ${body.subType ?? body.type ?? 'unknown body'}`}
        className={[
          'system-body',
          `system-body--${kind}`,
          kind === 'star' ? 'system-body--star' : '',
          child ? 'system-body--child' : '',
          selectedName === body.name ? 'is-selected' : ''
        ].filter(Boolean).join(' ')}
        onClick={() => onSelect(body.name)}
        type="button"
      >
        <span className="system-body__distance">{formatDistance(body.distanceToArrival)}</span>
        <BodyGlyph kind={kind} ringed={isRinged(body)} />
        <strong>{shortBodyName(body.name, systemName)}</strong>
        <small>{shortType(body)}</small>
        <span className="system-body__badges">
          {body.local?.mapped && <i title="Mapped">M</i>}
          {body.local?.surfaceScanCompleted && <i title="Surface scan complete">S</i>}
          {signals && signals.biological > 0 && <i className="is-signal" title="Biological signals">B{signals.biological}</i>}
          {signals && signals.geological > 0 && <i className="is-signal" title="Geological signals">G{signals.geological}</i>}
        </span>
      </button>
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
      <dl>
        <div><dt>Known</dt><dd>{system.scanProgress.knownBodies}</dd></div>
        <div><dt>Reported</dt><dd>{system.scanProgress.reportedBodies ?? '—'}</dd></div>
        <div><dt>Mapped</dt><dd>{system.scanProgress.percent == null ? '—' : `${system.scanProgress.percent}%`}</dd></div>
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

function CartographyDetail ({ commanderName, onBookmarkBody, selection }: { commanderName?: string | null, onBookmarkBody?(name: string): void, selection: CartographicSelection }) {
  if (isStation(selection)) return <StationDetail station={selection} />
  return <BodyDetail body={selection} commanderName={commanderName} onBookmark={onBookmarkBody} />
}

function BodyDetail ({ body, commanderName, onBookmark }: { body: CartographicBody, commanderName?: string | null, onBookmark?(name: string): void }) {
  const signals = body.local?.signals
  const details = body.details
  const orbit = details.orbit
  const stellar = isStellarBody(body)
  const hasOrbit = Object.values(orbit).some(value => value !== null)
  return (
    <aside className="cartography-detail">
      <header className="cartography-detail__body">
        <BodyGlyph kind={bodyKind(body)} ringed={isRinged(body)} />
        <div><span>Body</span><h2>{body.name}</h2><p>{bodyTypeLabel(body)}</p></div>
      </header>
      <DetailSection title="Navigation">
        <Fact label="Arrival" value={formatDistance(body.distanceToArrival)} />
        {stellar && <Fact label="Scoopable" value={booleanLabel(details.isScoopable)} />}
        {!stellar && <Fact label="Landable" value={booleanLabel(body.landable)} />}
      </DetailSection>
      <DetailSection title="Survey">
        <Fact label="Scanned" value={booleanLabel(body.local?.discovered)} />
        {!stellar && (
          <>
            <Fact label="Mapped" value={booleanLabel(body.local?.mapped)} />
            <Fact label="Set foot" value={booleanLabel(body.local?.footfalled)} />
          </>
        )}
        <Fact label="First discovered" value={firstCommander(body.local?.firstDiscoveredByCommander, body.firstDiscoveredBy, commanderName)} />
        {!stellar && (
          <>
            <Fact label="First mapped" value={firstCommander(body.local?.firstMappedByCommander, body.firstMappedBy, commanderName)} />
            <Fact label="First footfall" value={firstFootfall(body)} />
          </>
        )}
      </DetailSection>
      {!stellar && (
        <DetailSection title="Environment">
          <Fact label="Mass" value={formatMass(details.massEarths, details.solarMasses)} />
          <Fact label="Gravity" value={formatUnit(body.gravityGs, 'g', 2)} />
          <Fact label="Temperature" value={formatUnit(body.surfaceTemperatureKelvin, ' K', 0)} />
          <Fact label="Radius" value={formatUnit(body.radiusKilometres, ' km', 0)} />
          <Fact label="Pressure" value={formatPressure(details.surfacePressurePascals)} />
          <Fact label="Atmosphere" value={body.atmosphere} />
          <Fact label="Volcanism" value={details.volcanism} />
          <Fact label="Terraforming" value={details.terraformState} />
          <Fact label="Tidal lock" value={booleanLabel(details.tidallyLocked)} />
        </DetailSection>
      )}
      {stellar && (
        <DetailSection title="Star">
          <Fact label="Mass" value={formatMass(details.massEarths, details.solarMasses)} />
          <Fact label="Temperature" value={formatUnit(body.surfaceTemperatureKelvin, ' K', 0)} />
          <Fact label="Radius" value={formatUnit(body.radiusKilometres, ' km', 0)} />
          <Fact label="Tidal lock" value={booleanLabel(details.tidallyLocked)} />
          <Fact label="Class" value={details.spectralClass} />
          <Fact label="Subclass" value={details.starSubclass === null ? null : String(details.starSubclass)} />
          <Fact label="Luminosity" value={details.luminosity} />
          <Fact label="Age" value={formatUnit(details.ageMillionYears, ' million years', 0)} />
          <Fact label="Absolute magnitude" value={formatNumberValue(details.absoluteMagnitude, 2)} />
          <Fact label="Solar radius" value={formatUnit(details.solarRadius, ' R☉', 2)} />
          <Fact label="Main star" value={booleanLabel(details.isMainStar)} />
        </DetailSection>
      )}
      {details.atmosphereComposition.length > 0 && (
        <DetailSection title="Atmosphere composition">
          <TagList values={details.atmosphereComposition.map(item => `${item.name} ${formatPercent(item.percent)}`)} />
        </DetailSection>
      )}
      {details.solidComposition && (
        <DetailSection title="Solid composition">
          <TagList values={[
            compositionLabel('Ice', details.solidComposition.icePercent),
            compositionLabel('Rock', details.solidComposition.rockPercent),
            compositionLabel('Metal', details.solidComposition.metalPercent)
          ].filter((value): value is string => value !== null)} />
        </DetailSection>
      )}
      {details.materials.length > 0 && (
        <DetailSection title="Materials">
          <TagList values={details.materials.map(item => `${item.name} ${formatPercent(item.percent)}`)} />
        </DetailSection>
      )}
      {hasOrbit && (
        <DetailSection title="Orbit and rotation">
          <Fact label="Semi-major axis" value={formatOrbitalDistance(orbit.semiMajorAxisKilometres)} />
          <Fact label="Orbital period" value={formatDuration(orbit.orbitalPeriodSeconds)} />
          <Fact label="Eccentricity" value={formatNumberValue(orbit.eccentricity, 4)} />
          <Fact label="Inclination" value={formatAngle(orbit.inclinationDegrees)} />
          <Fact label="Periapsis" value={formatAngle(orbit.periapsisDegrees)} />
          <Fact label="Ascending node" value={formatAngle(orbit.ascendingNodeDegrees)} />
          <Fact label="Mean anomaly" value={formatAngle(orbit.meanAnomalyDegrees)} />
          <Fact label="Rotation period" value={formatDuration(orbit.rotationPeriodSeconds)} />
          <Fact label="Axial tilt" value={formatAngle(orbit.axialTiltDegrees)} />
        </DetailSection>
      )}
      {details.rings.length > 0 && (
        <DetailSection title="Rings">
          <Fact label="Reserves" value={details.reserveLevel} />
          {details.rings.map(ring => (
            <Fact
              key={ring.name}
              label={shortBodyName(ring.name)}
              value={ringDescription(ring)}
            />
          ))}
        </DetailSection>
      )}
      {body.local?.signalDetails.length ? (
        <DetailSection title="Signals">
          {body.local.signalDetails.map(signal => <Fact key={signal.type} label={signal.type} value={String(signal.count)} />)}
        </DetailSection>
      ) : signals && (signals.biological + signals.geological + signals.human > 0) ? (
        <DetailSection title="Signals">
          {signals.biological > 0 && <Fact label="Biological" value={String(signals.biological)} />}
          {signals.geological > 0 && <Fact label="Geological" value={String(signals.geological)} />}
          {signals.human > 0 && <Fact label="Human" value={String(signals.human)} />}
        </DetailSection>
      ) : null}
      {body.local?.biologicalGenuses.length ? (
        <DetailSection title="Biological genera"><TagList values={body.local.biologicalGenuses} /></DetailSection>
      ) : null}
      {onBookmark && (
        <footer className="cartography-detail__actions">
          <Button alignment="start" type="button" variant="outline" onClick={() => onBookmark(body.name)}>Bookmark body</Button>
        </footer>
      )}
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

function isStellarBody (body: CartographicBody): boolean {
  const kind = bodyKind(body)
  return kind === 'star' || kind === 'black-hole'
}

const starTypeLabels: Readonly<Record<string, string>> = {
  O: 'Blue Main-Sequence Star',
  B: 'Blue-White Main-Sequence Star',
  A: 'White Main-Sequence Star',
  F: 'Yellow-White Main-Sequence Star',
  G: 'Yellow Dwarf',
  K: 'Orange Dwarf',
  M: 'Red Dwarf',
  L: 'Brown Dwarf',
  T: 'Brown Dwarf',
  Y: 'Brown Dwarf',
  TTS: 'T Tauri Star',
  AEBE: 'Herbig Ae/Be Star',
  W: 'Wolf-Rayet Star',
  WN: 'Nitrogen-Rich Wolf-Rayet Star',
  WNC: 'Transitional Wolf-Rayet Star',
  WC: 'Carbon-Rich Wolf-Rayet Star',
  WO: 'Oxygen-Rich Wolf-Rayet Star',
  CS: 'Carbon Star',
  C: 'Carbon Star',
  CN: 'Carbon Star',
  CJ: 'Carbon Star',
  CH: 'Carbon Star',
  CHD: 'Hydrogen-Deficient Carbon Star',
  MS: 'MS-Type Star',
  S: 'S-Type Star',
  D: 'White Dwarf',
  DA: 'DA-Type White Dwarf',
  DAB: 'DAB-Type White Dwarf',
  DAO: 'DAO-Type White Dwarf',
  DAZ: 'DAZ-Type White Dwarf',
  DAV: 'DAV-Type White Dwarf',
  DB: 'DB-Type White Dwarf',
  DBZ: 'DBZ-Type White Dwarf',
  DBV: 'DBV-Type White Dwarf',
  DO: 'DO-Type White Dwarf',
  DOV: 'DOV-Type White Dwarf',
  DQ: 'DQ-Type White Dwarf',
  DC: 'DC-Type White Dwarf',
  DCV: 'DCV-Type White Dwarf',
  DX: 'DX-Type White Dwarf',
  N: 'Neutron Star',
  H: 'Black Hole',
  X: 'Exotic Star',
  SUPERMASSIVEBLACKHOLE: 'Supermassive Black Hole',
  A_BLUEWHITESUPERGIANT: 'Blue-White Supergiant',
  F_WHITESUPERGIANT: 'White Supergiant',
  M_REDSUPERGIANT: 'Red Supergiant',
  M_REDGIANT: 'Red Giant',
  K_ORANGEGIANT: 'Orange Giant',
  ROGUEPLANET: 'Rogue Planet',
  NEBULA: 'Nebula',
  STELLARREMNANTNEBULA: 'Stellar Remnant Nebula'
}

function bodyTypeLabel (body: CartographicBody): string {
  if (!isStellarBody(body)) return body.subType ?? body.type ?? 'Unclassified'
  const classification = body.details.spectralClass ?? body.subType
  const code = classification?.trim().match(/^[A-Za-z_]+/)?.[0].toLocaleUpperCase()
  return (code && starTypeLabels[code]) ?? body.subType ?? body.type ?? 'Unclassified'
}

function isRinged (body: CartographicBody): boolean {
  return body.ringed
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

function shortBodyName (name: string, systemName?: string): string {
  if (systemName) {
    const prefix = `${systemName} `
    if (name.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
      return name.slice(prefix.length).trim()
    }
  }
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

function booleanLabel (value: unknown): string | null {
  return typeof value === 'boolean' ? value ? 'Yes' : 'No' : null
}

function firstCommander (credited: boolean | undefined, reportedName: string | null, commanderName: string | null | undefined): string {
  if (credited) return commanderName ?? 'Current commander'
  return reportedName ?? 'Unknown'
}

function firstFootfall (body: CartographicBody): string {
  if (body.firstFootfallBy) return body.firstFootfallBy
  if (body.local?.previouslyFootfalled === false) return 'Unclaimed when scanned'
  if (body.local?.previouslyFootfalled === true) return 'Claimed'
  return 'Unknown'
}

function formatMass (earthMasses: number | null, solarMasses: number | null): string | null {
  if (earthMasses !== null) return `${formatNumberValue(earthMasses, 4)} M⊕`
  if (solarMasses !== null) return `${formatNumberValue(solarMasses, 4)} M☉`
  return null
}

function formatPressure (pascals: number | null): string | null {
  if (pascals === null) return null
  const atmospheres = pascals / 101_325
  return `${pascals.toLocaleString(undefined, { maximumFractionDigits: 0 })} Pa · ${atmospheres.toLocaleString(undefined, { maximumSignificantDigits: 3 })} atm`
}

function formatPercent (value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function compositionLabel (name: string, value: number | null): string | null {
  return value === null ? null : `${name} ${formatPercent(value)}`
}

function formatNumberValue (value: number | null, decimals: number): string | null {
  return value === null ? null : value.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function formatAngle (value: number | null): string | null {
  return value === null ? null : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}°`
}

function formatDuration (seconds: number | null): string | null {
  if (seconds === null) return null
  const absolute = Math.abs(seconds)
  if (absolute >= 86_400) return `${(seconds / 86_400).toLocaleString(undefined, { maximumFractionDigits: 2 })} d`
  if (absolute >= 3_600) return `${(seconds / 3_600).toLocaleString(undefined, { maximumFractionDigits: 2 })} h`
  if (absolute >= 60) return `${(seconds / 60).toLocaleString(undefined, { maximumFractionDigits: 2 })} min`
  return `${seconds.toLocaleString(undefined, { maximumFractionDigits: 1 })} s`
}

function formatOrbitalDistance (kilometres: number | null): string | null {
  if (kilometres === null) return null
  const astronomicalUnits = kilometres / 149_597_870.7
  return astronomicalUnits >= 0.01
    ? `${astronomicalUnits.toLocaleString(undefined, { maximumFractionDigits: 3 })} au`
    : `${kilometres.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`
}

function ringDescription (ring: CartographicBody['details']['rings'][number]): string {
  const radii = ring.innerRadiusKilometres !== null && ring.outerRadiusKilometres !== null
    ? `${ring.innerRadiusKilometres.toLocaleString(undefined, { maximumFractionDigits: 0 })}–${ring.outerRadiusKilometres.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`
    : null
  const mass = ring.massMegatonnes === null
    ? null
    : `${ring.massMegatonnes.toLocaleString(undefined, { maximumSignificantDigits: 4 })} Mt`
  return [ring.type, radii, mass].filter(Boolean).join(' · ') || 'Reported'
}

function formatUnit (value: number | null, unit: string, decimals: number): string | null {
  return value == null ? null : `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}${unit}`
}
