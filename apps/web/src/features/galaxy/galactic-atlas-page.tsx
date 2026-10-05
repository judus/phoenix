import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SetStateAction } from 'react'
import { Breadcrumbs, Button, ControlContext, IconButton, Inline, PageFrame, PageHeader, Select, Status, ToggleButton } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import { atlasBoundaries, atlasRegions } from './atlas-region-data.js'
import { ATLAS_LANDMARKS, LY_PER_MAP_UNIT, WHOLE_GALAXY, atlasScale, clusterAtlasMarkers, distanceLy, galacticRegion, projectGalacticPosition, screenPoint, zoomAtlas, type AtlasCamera, type AtlasMarker, type AtlasPoint, type GalacticPosition } from './galactic-atlas-model.js'
import { useAtlasBookmarks } from './use-atlas-bookmarks.js'
import { useAtlasPointerGestures } from './use-atlas-pointer-gestures.js'

export function GalacticAtlasPage({ api, onNavigate, runtime }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
  runtime: RuntimeStateSnapshot
}) {
  const [showBookmarks, setShowBookmarks] = useState(true)
  const bookmarks = useAtlasBookmarks(api, showBookmarks)
  const system = runtime.status === 'ready' ? runtime.state.system : undefined
  return <GalacticAtlas
    bookmarks={showBookmarks ? bookmarks.markers : []}
    bookmarkStatus={bookmarks.error ?? (bookmarks.pending ? `Locating ${bookmarks.pending} bookmark${bookmarks.pending === 1 ? '' : 's'}…` : [
      bookmarks.unresolved ? `${bookmarks.unresolved} bookmark${bookmarks.unresolved === 1 ? '' : 's'} without coordinates: ${bookmarks.missingSystems.join(', ')}` : '',
      bookmarks.failures.length ? `Bookmark lookup failed — ${bookmarks.failures.join('; ')}` : ''
    ].filter(Boolean).join(' · ') || undefined)}
    onNavigate={onNavigate}
    onToggleBookmarks={() => setShowBookmarks(value => !value)}
    position={system?.position ?? null}
    showBookmarks={showBookmarks}
    systemName={system?.name ?? null}
  />
}

/** Unique cartographic instrument. SVG coordinates/transforms are runtime geometry, not layout styling. */
export function GalacticAtlas({ bookmarks, bookmarkStatus, onNavigate, onToggleBookmarks, position, showBookmarks, systemName }: {
  bookmarks: AtlasMarker[]
  bookmarkStatus?: string
  onNavigate(route: PhoenixRoute): void
  onToggleBookmarks(): void
  position: GalacticPosition | null
  showBookmarks: boolean
  systemName: string | null
}) {
  const [camera, setCamera] = useState<AtlasCamera>(() => position ? { ...projectGalacticPosition(position), zoom: 4 } : WHOLE_GALAXY)
  const initialCameraApplied = useRef(position !== null)
  const updateCamera = (next: SetStateAction<AtlasCamera>) => {
    initialCameraApplied.current = true
    setCamera(next)
  }
  const [size, setSize] = useState({ width: 900, height: 600 })
  const [showRegions, setShowRegions] = useState(true)
  const [showLandmarks, setShowLandmarks] = useState(true)
  const [selection, setSelection] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const viewport = useRef<HTMLDivElement>(null)
  const pointerGestures = useAtlasPointerGestures(updateCamera, size)
  const currentRegion = position ? galacticRegion(position) : undefined
  const markers = useMemo(() => [
    ...(position && systemName ? [{ id: 'commander', kind: 'commander' as const, label: systemName, systemName, position }] : []),
    ...(showLandmarks ? ATLAS_LANDMARKS : []),
    ...bookmarks
  ], [bookmarks, position, showLandmarks, systemName])
  const selected = markers.find(marker => marker.id === selectedId)
  const options = selection.map(id => markers.find(marker => marker.id === id)).filter((marker): marker is AtlasMarker => !!marker)
  const clusters = clusterAtlasMarkers(markers, camera, size.width, size.height)
  const scale = atlasScale(size.width, size.height, camera.zoom)
  const centre = { x: size.width / 2, y: size.height / 2 }
  const changeZoom = (factor: number) => updateCamera(value => zoomAtlas(value, factor, centre, size.width, size.height))
  const locate = (target: GalacticPosition, zoom = Math.max(4, camera.zoom)) => updateCamera({ ...projectGalacticPosition(target), zoom })

  useEffect(() => {
    if (!position || initialCameraApplied.current) return
    initialCameraApplied.current = true
    setCamera({ ...projectGalacticPosition(position), zoom: 4 })
  }, [position])

  useEffect(() => {
    const element = viewport.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      initialCameraApplied.current = true
      const rect = element.getBoundingClientRect()
      setCamera(value => zoomAtlas(value, Math.exp(-Math.max(-150, Math.min(150, event.deltaY)) * 0.005), { x: event.clientX - rect.left, y: event.clientY - rect.top }, size.width, size.height))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [size])

  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === '+' || event.key === '=') changeZoom(1.5)
    else if (event.key === '-') changeZoom(1 / 1.5)
    else if (event.key === 'Home') updateCamera(WHOLE_GALAXY)
    else if (event.key.startsWith('Arrow')) updateCamera(value => ({ ...value,
      x: value.x + (event.key === 'ArrowLeft' ? -80 : event.key === 'ArrowRight' ? 80 : 0) / scale,
      y: value.y + (event.key === 'ArrowUp' ? -80 : event.key === 'ArrowDown' ? 80 : 0) / scale
    }))
    else return
    event.preventDefault()
  }

  // Collision boxes are screen-space so labels never grow into each other when zooming.
  const occupied: { x: number, y: number, width: number, height: number }[] = []
  function labelFits(point: AtlasPoint, text: string, centered = false) {
    const width = text.length * 7.5 + 12
    const box = { x: point.x - (centered ? width / 2 : 0), y: point.y - 14, width, height: 22 }
    if (box.x < 4 || box.y < 4 || box.x + width > size.width - 4 || box.y + box.height > size.height - 4) return false
    if (occupied.some(other => box.x < other.x + other.width && box.x + width > other.x && box.y < other.y + other.height && box.y + box.height > other.y)) return false
    occupied.push(box)
    return true
  }
  const scaleLy = niceScale(120 / scale * LY_PER_MAP_UNIT)

  return <PageFrame layout="fit" className="galactic-atlas-page">
    <PageHeader title="Galactic atlas" variant="cockpit" context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/atlas' }, { label: 'Galactic atlas' }]} />} actions={<ControlContext context="toolbar" density="compact"><Inline gap="xs">
        <ToggleButton className="display" pressed={showRegions} onClick={() => setShowRegions(value => !value)}>Regions</ToggleButton>
        <ToggleButton className="display" pressed={showLandmarks} onClick={() => setShowLandmarks(value => !value)}>Landmarks</ToggleButton>
        <ToggleButton className="display" pressed={showBookmarks} onClick={onToggleBookmarks}>Bookmarks</ToggleButton>
    </Inline></ControlContext>} />
    <section className={`galactic-atlas${selected ? ' has-selection' : ''}`} aria-label="Galactic atlas" data-deskplane-no-swipe>
      <div className="atlas-map">
      <div className="atlas-viewport" ref={viewport} {...pointerGestures} onClick={event => {
        if ((event.target as Element).closest('[role="button"]')) return
        setSelection([])
        setSelectedId(undefined)
      }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} tabIndex={0} role="group"
          aria-label="Top-down galaxy map. Drag to pan, pinch or use plus and minus to zoom. Arrow keys pan; Home shows the whole galaxy."
          onKeyDown={keyboard}>
          <g transform={`translate(${centre.x - camera.x * scale} ${centre.y - camera.y * scale}) scale(${scale})`}>
            <g className="atlas-grid" aria-hidden="true">
              {[0, 500, 1000, 1500, 2000].map(value => <path key={value} d={`M${value},0V2048M0,${value}H2048`} vectorEffect="non-scaling-stroke" />)}
            </g>
            <g className="atlas-regions">
              {atlasRegions.map(region => <path key={region.id} d={region.path} className={showRegions && region.id === currentRegion?.id ? 'active' : undefined}><title>{region.name}</title></path>)}
            </g>
            {showRegions && <path className="atlas-boundaries" d={atlasBoundaries} vectorEffect="non-scaling-stroke" />}
          </g>
          {clusters.map(cluster => {
            const marker = cluster.markers[0]
            const active = cluster.markers.some(marker => marker.id === selectedId)
            const commander = cluster.markers.some(marker => marker.kind === 'commander')
            const text = `${commander ? 'YOU · ' : ''}${marker.label}${cluster.markers.length > 1 ? ` +${cluster.markers.length - 1}` : ''}`
            const point = { x: cluster.point.x + 16, y: cluster.point.y - 10 }
            const visibleLabel = labelFits(point, text)
            const choose = () => { setSelection(cluster.markers.map(marker => marker.id)); setSelectedId(marker.id) }
            return <g key={marker.id} className={`atlas-marker ${commander ? 'commander' : marker.kind}${active ? ' active' : ''}`}
              transform={`translate(${cluster.point.x} ${cluster.point.y})`} role="button" tabIndex={0}
              aria-label={cluster.markers.length > 1 ? `${cluster.markers.length} locations near ${marker.label}` : `${commander ? 'Your position: ' : ''}${marker.label}`}
              onClick={choose} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose() } }}>
              <title>{cluster.markers.map(marker => marker.label).join(' · ')}</title>
              <circle className="hit-area" r={22} />
              {commander ? <path d="M0,-10L7,7L0,3L-7,7Z" /> : marker.kind === 'bookmark' ? <path d="M-5,-7H5V8L0,4L-5,8Z" /> : <circle r={cluster.markers.length > 1 ? 7 : 4} />}
              {cluster.markers.length > 1 && <circle className="cluster-ring" r={12} />}
              {visibleLabel && <text x={16} y={-10}>{text}</text>}
            </g>
          })}
          {showRegions && [...atlasRegions].sort((a, b) => Number(b.id === currentRegion?.id) - Number(a.id === currentRegion?.id)).map(region => {
            const point = screenPoint({ x: region.label[0], y: region.label[1] }, camera, size.width, size.height)
            if (camera.zoom < 1.8 && region.id !== currentRegion?.id && region.id !== 1 && region.id % 3 !== 0) return null
            if (!labelFits(point, region.name, true)) return null
            return <text key={region.id} x={point.x} y={point.y} className={`atlas-region-label${region.id === currentRegion?.id ? ' active' : ''}`}>{region.name}</text>
          })}
          <g className="atlas-scale" transform={`translate(20 ${size.height - 22})`} aria-label={`Scale ${scaleLy.toLocaleString('en-GB')} light years`}>
            <path d={`M0,-5V0H${scaleLy / LY_PER_MAP_UNIT * scale}V-5`} />
            <text x={0} y={-12}>{scaleLy.toLocaleString('en-GB')} LY</text>
          </g>
          <text className="atlas-orientation" x={size.width - 16} y={24}>+Z ↑ · X/Z</text>
        </svg>
      </div>
        <div className="atlas-zoom" role="group" aria-label="Atlas zoom controls">
          <IconButton variant="outline" size="sm" label="Zoom out" disabled={camera.zoom <= 1} onClick={() => changeZoom(1 / 1.5)}>−</IconButton>
          <IconButton variant="outline" size="sm" label="Zoom in" disabled={camera.zoom >= 64} onClick={() => changeZoom(1.5)}>+</IconButton>
        </div>
      </div>
      {selected && <aside className="atlas-inspector" aria-label="Selected atlas location">
        <header>
          <span>Selected location</span>
        </header>
        {options.length > 1 ? <Select className="form-mini" aria-label="Locations in this group" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {options.map(marker => <option key={marker.id} value={marker.id}>{marker.kind === 'commander' ? 'You · ' : ''}{marker.label}</option>)}
        </Select> : <h2>{selected.label}</h2>}
        <dl>
          <div><dt>System</dt><dd><AtlasSystemLink systemName={selected.systemName} selectedName={selected.selectedName} onNavigate={onNavigate} /></dd></div>
          {position && <div><dt>Distance from you</dt><dd>{formatLy(distanceLy(position, selected.position))} LY</dd></div>}
        </dl>
        <ControlContext context="toolbar" density="compact">
          <Button className="display" variant="outline" onClick={() => locate(selected.position, Math.min(64, Math.max(4, camera.zoom * 2)))}>Zoom here</Button>
        </ControlContext>
      </aside>}
      <footer className="atlas-telemetry">
        {position ? <>
          {systemName ? <AtlasSystemLink systemName={systemName} onNavigate={onNavigate} /> : <strong>Position known</strong>}
          <span>{currentRegion?.name ?? 'Outside mapped regions'}</span>
          <span>Sol · {formatLy(distanceLy(position, [0, 0, 0]))} LY</span>
          <span>{formatLy(Math.abs(position[1]))} LY {position[1] < 0 ? 'below' : 'above'} plane</span>
        </> : <Status tone="muted">Current position unavailable — waiting for journal coordinates.</Status>}
        {showBookmarks && bookmarkStatus && <small role="status">{bookmarkStatus}</small>}
      </footer>
    </section>
  </PageFrame>
}

function AtlasSystemLink({ systemName, selectedName, onNavigate }: { systemName: string, selectedName?: string, onNavigate(route: PhoenixRoute): void }) {
  const route: PhoenixRoute = { kind: 'information', section: 'galaxy', view: 'system', systemName, ...(selectedName ? { selectedName } : {}) }
  return <a className="atlas-system-link" href={phoenixRouteHash(route)} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(route)
  }}>{systemName}</a>
}

function formatLy(value: number): string { return value.toLocaleString('en-GB', { maximumFractionDigits: 0 }) }
function niceScale(value: number): number { const power = 10 ** Math.floor(Math.log10(value)); return ([5, 2, 1].find(step => step * power <= value) ?? 1) * power }
