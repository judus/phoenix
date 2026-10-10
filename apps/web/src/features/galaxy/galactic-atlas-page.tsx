import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react'
import { BookmarkIcon, Breadcrumbs, Button, ControlContext, Field, FlagIcon, IconButton, Inline, MapPinIcon, PageFrame, PageHeader, RadarIcon, RegionsIcon, RouteIcon, SearchIcon, Select, Status, TextInput, ToggleButton } from '@phoenix/ui'
import type { AtlasCatalogueResponse, AtlasDisplayLocation, CommunityGoalsResponse, NavigationRoute } from '@phoenix/contracts'
import { PhoenixDateTime, UpdatedDateTime } from '../../components/phoenix-date-time.js'
import { AddNoteButton } from '../../components/add-note-button.js'
import { atlasNavigationRoute, atlasNoteTarget } from './galactic-atlas-model.js'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import { atlasBoundaries, atlasRegions } from './atlas-region-data.js'
import { ATLAS_LANDMARKS, LY_PER_MAP_UNIT, MAX_ATLAS_ZOOM, WHOLE_GALAXY, TOP_DOWN_VIEW, TILTED_VIEW, atlasPlaneTransform, atlasPoiMarkers, filterAtlasPois, atlasScale, clusterAtlasMarkers, distanceLy, focusAtlas, galacticRegion, orbitAtlas, panAtlas, projectGalacticPosition, screenPoint, zoomAtlas, type AtlasCamera, type AtlasMarker, type AtlasPoint, type GalacticPosition } from './galactic-atlas-model.js'
import { useAtlasBookmarks } from './use-atlas-bookmarks.js'
import { useAtlasPointerGestures } from './use-atlas-pointer-gestures.js'
import { useAtlasCatalogue } from './use-atlas-catalogue.js'
import { useAtlasCommunityGoals } from './use-atlas-community-goals.js'
import { useAtlasGalnetLeads } from './use-atlas-galnet-leads.js'
import { formatCommunityGoalExpiry } from '../../application/community-goals/community-goal-expiry.js'

export function GalacticAtlasPage({ api, onNavigate, runtime, location, displayRequestId, navigationRoute, routeStatus }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
  runtime: RuntimeStateSnapshot
  location?: AtlasDisplayLocation
  displayRequestId?: string
  navigationRoute?: NavigationRoute
  routeStatus?: string
}) {
  const system = runtime.status === 'ready' ? runtime.state.system : undefined
  return <GalacticAtlasWorkspace api={api} onNavigate={onNavigate} position={system?.position ?? null}
    systemName={system?.name ?? null} location={location} displayRequestId={displayRequestId}
    navigationRoute={navigationRoute} routeStatus={routeStatus} />
}

type AtlasResults = { markers: AtlasMarker[], status: string, fitReady: boolean, initialCamera?: AtlasCamera, detail(marker: AtlasMarker): ReactNode }
type AtlasLayout = (controls: ReactNode, instrument: ReactNode) => ReactNode

/** Owns the same live layers and controls wherever the Atlas is displayed. */
export function GalacticAtlasWorkspace({ api, onNavigate, position, systemName, location, displayRequestId, navigationRoute, routeStatus, results, renderLayout }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
  position: GalacticPosition | null
  systemName: string | null
  location?: AtlasDisplayLocation
  displayRequestId?: string
  navigationRoute?: NavigationRoute
  routeStatus?: string
  results?: AtlasResults
  renderLayout?: AtlasLayout
}) {
  const [showBookmarks, setShowBookmarks] = useState(true)
  const [showCommunityGoals, setShowCommunityGoals] = useState(true)
  const [showInvestigations, setShowInvestigations] = useState(true)
  const bookmarks = useAtlasBookmarks(api, showBookmarks)
  const communityGoals = useAtlasCommunityGoals(api, showCommunityGoals)
  const investigations = useAtlasGalnetLeads(api, showInvestigations)
  const omitted = investigations.snapshot?.omitted
  const catalogue = useAtlasCatalogue(api)
  return <GalacticAtlas
    results={results}
    renderLayout={renderLayout}
    navigationRoute={navigationRoute}
    routeStatus={routeStatus}
    location={location}
    displayRequestId={displayRequestId}
    catalogue={catalogue.catalogue}
    catalogueStatus={catalogue.error ?? (catalogue.loading ? 'Loading POI catalogue…' : undefined)}
    communityGoals={showCommunityGoals ? communityGoals.markers : []}
    communityGoalsSnapshot={communityGoals.snapshot}
    investigations={investigations.markers}
    investigationsStatus={[
      investigations.loading ? 'Loading saved GalNet leads…' : '',
      investigations.error,
      omitted?.changedReports ? `${omitted.changedReports} changed-article report${omitted.changedReports === 1 ? '' : 's'} hidden` : '',
      omitted?.endedLeads ? `${omitted.endedLeads} ended lead${omitted.endedLeads === 1 ? '' : 's'} hidden` : '',
      omitted?.withoutDestination ? `${omitted.withoutDestination} lead${omitted.withoutDestination === 1 ? ' has' : 's have'} no known destination` : '',
      investigations.unlocatedSystems.length ? `Lead destinations not located: ${investigations.unlocatedSystems.join(', ')}` : ''
    ].filter(Boolean).join(' · ') || undefined}
    communityGoalsStatus={[
      communityGoals.loading ? 'Loading Community Goals…' : '',
      communityGoals.error ? `CG refresh failed: ${communityGoals.error}${communityGoals.snapshot ? ' Showing the previous snapshot.' : ''}` : '',
      communityGoals.snapshot?.cache === 'stale' ? 'CG data is stale; availability and progress may have changed.' : '',
      communityGoals.snapshot?.goals.length === 0 && communityGoals.snapshot.cache !== 'stale' && !communityGoals.error ? 'No Community Goals currently listed.' : '',
      communityGoals.unlocatedSystems.length ? `CG destinations not located: ${communityGoals.unlocatedSystems.join(', ')}` : ''
    ].filter(Boolean).join(' · ') || undefined}
    bookmarks={showBookmarks ? bookmarks.markers : []}
    bookmarkStatus={bookmarks.error ?? (bookmarks.pending ? `Locating ${bookmarks.pending} bookmark${bookmarks.pending === 1 ? '' : 's'}…` : [
      bookmarks.unresolved ? `${bookmarks.unresolved} bookmark${bookmarks.unresolved === 1 ? '' : 's'} without coordinates: ${bookmarks.missingSystems.join(', ')}` : '',
      bookmarks.failures.length ? `Bookmark lookup failed — ${bookmarks.failures.join('; ')}` : ''
    ].filter(Boolean).join(' · ') || undefined)}
    onNavigate={onNavigate}
    onToggleBookmarks={() => setShowBookmarks(value => !value)}
    onToggleCommunityGoals={() => setShowCommunityGoals(value => !value)}
    onToggleInvestigations={() => setShowInvestigations(value => !value)}
    position={position}
    showBookmarks={showBookmarks}
    showCommunityGoals={showCommunityGoals}
    showInvestigations={showInvestigations}
    systemName={systemName}
  />
}

/** Unique cartographic instrument. SVG coordinates/transforms are runtime geometry, not layout styling. */
export function GalacticAtlas({ bookmarks, bookmarkStatus, catalogue, catalogueStatus, communityGoals, communityGoalsSnapshot, communityGoalsStatus, investigations, investigationsStatus, onNavigate, onToggleBookmarks, onToggleCommunityGoals, onToggleInvestigations, position, showBookmarks, showCommunityGoals = false, showInvestigations = false, systemName, location, displayRequestId, navigationRoute, routeStatus, results, renderLayout }: {
  results?: AtlasResults
  renderLayout?: AtlasLayout
  location?: AtlasDisplayLocation
  displayRequestId?: string
  navigationRoute?: NavigationRoute
  routeStatus?: string
  bookmarks: AtlasMarker[]
  bookmarkStatus?: string
  catalogue?: AtlasCatalogueResponse
  catalogueStatus?: string
  communityGoals?: AtlasMarker[]
  communityGoalsSnapshot?: CommunityGoalsResponse
  communityGoalsStatus?: string
  investigations?: AtlasMarker[]
  investigationsStatus?: string
  onNavigate(route: PhoenixRoute): void
  onToggleBookmarks(): void
  onToggleCommunityGoals?(): void
  onToggleInvestigations?(): void
  position: GalacticPosition | null
  showBookmarks: boolean
  showCommunityGoals?: boolean
  showInvestigations?: boolean
  systemName: string | null
}) {
  const [camera, setCamera] = useState<AtlasCamera>(() => results?.initialCamera ?? (position ? { ...projectGalacticPosition(position), zoom: 4 } : WHOLE_GALAXY))
  const [view, setView] = useState(TOP_DOWN_VIEW)
  const [orbiting, setOrbiting] = useState(false)
  const initialCameraApplied = useRef(position !== null)
  const resultsCameraApplied = useRef(results?.fitReady ?? true)
  const cameraTouched = useRef(false)
  const updateCamera = (next: SetStateAction<AtlasCamera>) => {
    cameraTouched.current = true
    initialCameraApplied.current = true
    setCamera(next)
  }
  const [size, setSize] = useState({ width: 900, height: 600 })
  const [showRegions, setShowRegions] = useState(true)
  const [showRoute, setShowRoute] = useState(true)
  const [showLandmarks, setShowLandmarks] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const filtersActive = search.trim() !== '' || category !== ''
  const [selection, setSelection] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const viewport = useRef<HTMLDivElement>(null)
  const pointerGestures = useAtlasPointerGestures(updateCamera, size, view, {
    enabled: orbiting,
    move: delta => setView(current => orbitAtlas(current, delta))
  })
  const currentRegion = position ? galacticRegion(position) : undefined
  const pois = useMemo(() => atlasPoiMarkers(catalogue?.pois ?? []), [catalogue])
  const categories = useMemo(() => [...new Set(catalogue?.pois.flatMap(poi => poi.categories) ?? [])].sort(), [catalogue])
  const landmarks = useMemo(() => filterAtlasPois([...ATLAS_LANDMARKS, ...pois], search, category), [pois, search, category])
  const displayTarget = useMemo<AtlasMarker | undefined>(() => {
    if (!location) return undefined
    const landmark = ATLAS_LANDMARKS.find(marker => marker.systemName.toLowerCase() === location.systemName.toLowerCase())
    return { id: landmark?.id ?? 'display-target', kind: landmark?.kind ?? 'system',
      label: landmark?.label ?? location.systemName, systemName: location.systemName, position: location.position }
  }, [location])
  const plotted = useMemo(() => atlasNavigationRoute(navigationRoute, systemName), [navigationRoute, systemName])
  const markers = useMemo(() => [
    ...(displayTarget ? [displayTarget] : []),
    ...(position && systemName ? [{ id: 'commander', kind: 'commander' as const, label: systemName, systemName, position }] : []),
    ...(showCommunityGoals ? communityGoals ?? [] : []),
    ...(showInvestigations ? investigations ?? [] : []),
    ...bookmarks,
    ...(showRoute ? plotted.markers : []),
    ...(results?.markers ?? []),
    ...ATLAS_LANDMARKS.filter(marker => marker.id !== displayTarget?.id),
    ...(showLandmarks ? landmarks.filter(marker => marker.poi) : landmarks.filter(marker => marker.poi && marker.id === selectedId))
  ], [bookmarks, communityGoals, investigations, landmarks, position, showCommunityGoals, showInvestigations, showLandmarks, systemName, selectedId, displayTarget, showRoute, plotted, results])
  const selected = markers.find(marker => marker.id === selectedId)
  const options = selection.map(id => markers.find(marker => marker.id === id)).filter((marker): marker is AtlasMarker => !!marker)
  const clusters = clusterAtlasMarkers(markers, camera, size.width, size.height, view)
  const scale = atlasScale(size.width, size.height, camera.zoom)
  const centre = { x: size.width / 2, y: size.height / 2 }
  const changeZoom = (factor: number) => updateCamera(value => zoomAtlas(value, factor, centre, size.width, size.height, view))
  const locate = (target: GalacticPosition, zoom = Math.max(4, camera.zoom)) => updateCamera(focusAtlas(target, zoom, view))

  useEffect(() => {
    if (!displayTarget) {
      setSelection([])
      setSelectedId(undefined)
      return
    }
    initialCameraApplied.current = true
    setCamera(focusAtlas(displayTarget.position, 4, view))
    setSelection([displayTarget.id])
    setSelectedId(displayTarget.id)
    setShowSearch(false)
  }, [displayTarget, displayRequestId])

  useEffect(() => {
    if (!position || initialCameraApplied.current) return
    initialCameraApplied.current = true
    setCamera(focusAtlas(position, 4, view))
  }, [position])

  useEffect(() => {
    if (!results?.fitReady || resultsCameraApplied.current) return
    resultsCameraApplied.current = true
    initialCameraApplied.current = true
    if (!cameraTouched.current && results.initialCamera) setCamera(results.initialCamera)
  }, [results?.fitReady, results?.initialCamera])

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
      cameraTouched.current = true
      initialCameraApplied.current = true
      const rect = element.getBoundingClientRect()
      setCamera(value => zoomAtlas(value, Math.exp(-Math.max(-150, Math.min(150, event.deltaY)) * 0.005), { x: event.clientX - rect.left, y: event.clientY - rect.top }, size.width, size.height, view))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [size, view])

  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === '+' || event.key === '=') changeZoom(1.5)
    else if (event.key === '-') changeZoom(1 / 1.5)
    else if (event.key === 'Home') { updateCamera(WHOLE_GALAXY); setView(TOP_DOWN_VIEW); setOrbiting(false) }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const delta = { x: event.key === 'ArrowLeft' ? 80 : event.key === 'ArrowRight' ? -80 : 0,
        y: event.key === 'ArrowUp' ? 80 : event.key === 'ArrowDown' ? -80 : 0 }
      if (event.shiftKey && view.tilt) setView(current => orbitAtlas(current, delta))
      else updateCamera(value => panAtlas(value, delta, size.width, size.height, view))
    }
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

  const controls = <Inline gap="xs">
        <ToggleButton className="btn-icon btn-icon-square" aria-label="Regions" title="Show galactic regions" pressed={showRegions} onClick={() => setShowRegions(value => !value)}><RegionsIcon /></ToggleButton>
        <ToggleButton className="btn-icon btn-icon-square" aria-label="Bookmarks" title="Show bookmarks" pressed={showBookmarks} onClick={onToggleBookmarks}><BookmarkIcon /></ToggleButton>
        <ToggleButton className="btn-icon btn-icon-square" aria-label="Plotted route" title="Show the route plotted in Elite" pressed={showRoute} onClick={() => setShowRoute(value => !value)}><RouteIcon /></ToggleButton>
        {onToggleCommunityGoals && <ToggleButton className="btn-icon btn-icon-square" aria-label="Community Goal destinations" title="Show Community Goal destinations" pressed={showCommunityGoals} onClick={onToggleCommunityGoals}><FlagIcon /></ToggleButton>}
        {onToggleInvestigations && <ToggleButton className="btn-icon btn-icon-square" aria-label="GalNet investigation destinations" title="Show saved GalNet investigation leads, not confirmed live activities" pressed={showInvestigations} onClick={onToggleInvestigations}><RadarIcon /></ToggleButton>}
        <ToggleButton className="btn-icon btn-icon-square" aria-label={filtersActive ? 'Landmarks · filtered' : 'Landmarks'} title={filtersActive ? 'Show catalogue landmarks matching Finder filters' : 'Show catalogue landmarks on the map; Finder filters apply'} pressed={showLandmarks} onClick={() => setShowLandmarks(value => !value)}><MapPinIcon /></ToggleButton>
        <ToggleButton className="btn-icon btn-icon-square" aria-label="Finder" title="Search locations without showing the whole catalogue" pressed={showSearch} onClick={() => setShowSearch(value => !value)}><SearchIcon /></ToggleButton>
    </Inline>
  const instrument = <section className={`galactic-atlas${selected || showSearch ? ' has-selection' : ''}`} aria-label="Galactic atlas" data-deskplane-no-swipe>
      <div className="atlas-map">
      <div className="atlas-viewport" ref={viewport} {...pointerGestures} onClick={event => {
        if ((event.target as Element).closest('[role="button"]')) return
        setSelection([])
        setSelectedId(undefined)
        setShowSearch(false)
      }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} tabIndex={0} role="group"
          aria-label={`${view.tilt ? '3D orthographic' : 'Top-down'} galaxy map. Drag to ${orbiting ? 'orbit' : 'pan'}, pinch or use plus and minus to zoom. Arrow keys pan; Shift and arrows orbit in 3D; Home resets to the whole galaxy top-down.`}
          onKeyDown={keyboard}>
          <g className="atlas-plane" transform={atlasPlaneTransform(camera, size.width, size.height, view)}>
            <g className="atlas-grid" aria-hidden="true">
              {[0, 500, 1000, 1500, 2000].map(value => <path key={value} d={`M${value},0V2048M0,${value}H2048`} vectorEffect="non-scaling-stroke" />)}
            </g>
            <g className="atlas-regions">
              {atlasRegions.map(region => <path key={region.id} d={region.path} className={showRegions && region.id === currentRegion?.id ? 'active' : undefined}><title>{region.name}</title></path>)}
            </g>
            {showRegions && <path className="atlas-boundaries" d={atlasBoundaries} vectorEffect="non-scaling-stroke" />}
          </g>
          {showRoute && <g className="atlas-route" aria-label="Plotted jump legs">
            {plotted.legs.map(leg => {
              const from = screenPoint(projectGalacticPosition(leg.from), camera, size.width, size.height, view, leg.from[1])
              const to = screenPoint(projectGalacticPosition(leg.to), camera, size.width, size.height, view, leg.to[1])
              return <path key={leg.index} className={leg.completed ? 'completed' : undefined} d={`M${from.x},${from.y}L${to.x},${to.y}`} />
            })}
          </g>}
          {clusters.map(cluster => {
            const routeOnly = cluster.markers.every(marker => marker.kind === 'route')
            const resultMarker = cluster.markers.find(marker => marker.kind === 'query-result')
            const marker = resultMarker ?? (routeOnly ? cluster.markers.find(marker => marker.routeStop?.destination || marker.routeStop?.current) : undefined) ?? cluster.markers[0]
            const active = cluster.markers.some(marker => marker.id === selectedId)
            const commander = !resultMarker && cluster.markers.some(marker => marker.kind === 'commander')
            const communityGoal = cluster.markers.some(marker => marker.kind === 'community-goal')
            const investigation = cluster.markers.some(marker => marker.kind === 'investigation')
            const text = `${commander ? 'YOU · ' : ''}${marker.label}${cluster.markers.length > 1 ? ` +${cluster.markers.length - 1}` : ''}`
            const point = { x: cluster.point.x + 16, y: cluster.point.y - 10 }
            const visibleLabel = labelFits(point, text)
            const choose = () => { setSelection(cluster.markers.map(marker => marker.id)); setSelectedId(marker.id) }
            return <g key={marker.id} className={`atlas-marker ${commander ? 'commander' : communityGoal ? 'community-goal' : investigation ? 'investigation' : marker.kind}${active ? ' active' : ''}${routeOnly && cluster.markers.every(marker => marker.routeStop?.completed) ? ' completed' : ''}`}
              transform={`translate(${cluster.point.x} ${cluster.point.y})`} role="button" tabIndex={0}
              aria-label={cluster.markers.length > 1 ? `${cluster.markers.length} locations near ${marker.label}` : `${commander ? 'Your position: ' : ''}${marker.label}`}
              onClick={choose} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose() } }}>
              <title>{cluster.markers.map(marker => marker.label).join(' · ')}</title>
              {view.tilt !== 0 && <g className="atlas-height" aria-hidden="true">
                <path d={`M0,0L${cluster.ground.x - cluster.point.x},${cluster.ground.y - cluster.point.y}`} />
                <circle cx={cluster.ground.x - cluster.point.x} cy={cluster.ground.y - cluster.point.y} r={2} />
              </g>}
              <circle className="hit-area" r={22} />
              {commander ? <path d="M0,-10L7,7L0,3L-7,7Z" /> : communityGoal ? <path d="M0,-8L8,0L0,8L-8,0Z" /> : investigation ? <path d="M-8,0L-4,-7H4L8,0L4,7H-4Z" /> : marker.kind === 'bookmark' ? <path d="M-5,-7H5V8L0,4L-5,8Z" /> : <circle r={cluster.markers.length > 1 ? 7 : 4} />}
              {cluster.markers.length > 1 && <circle className="cluster-ring" r={12} />}
              {visibleLabel && <text x={16} y={-10}>{text}</text>}
            </g>
          })}
          {showRegions && [...atlasRegions].sort((a, b) => Number(b.id === currentRegion?.id) - Number(a.id === currentRegion?.id)).map(region => {
            const point = screenPoint({ x: region.label[0], y: region.label[1] }, camera, size.width, size.height, view)
            if (camera.zoom < 1.8 && region.id !== currentRegion?.id && region.id !== 1 && region.id % 3 !== 0) return null
            if (!labelFits(point, region.name, true)) return null
            return <text key={region.id} x={point.x} y={point.y} className={`atlas-region-label${region.id === currentRegion?.id ? ' active' : ''}`}>{region.name}</text>
          })}
          <g className="atlas-scale" transform={`translate(20 ${size.height - 22})`} aria-label={`Scale ${scaleLy.toLocaleString('en-GB')} light years`}>
            <path d={`M0,-5V0H${scaleLy / LY_PER_MAP_UNIT * scale}V-5`} />
            <text x={0} y={-12}>{scaleLy.toLocaleString('en-GB')} LY</text>
          </g>
          <text className="atlas-orientation" x={size.width - 16} y={24}>{view.tilt ? 'X/Z PLANE · Y HEIGHT' : '+Z ↑ · X/Z'}</text>
        </svg>
      </div>
        <div className="atlas-zoom" role="group" aria-label="Atlas zoom controls">
          <ToggleButton className="display btn-no-grip btn-min-square" aria-label="3D atlas view" title="Tilt the galactic plane and show real location heights" pressed={view.tilt !== 0} onClick={() => {
            setView(view.tilt ? TOP_DOWN_VIEW : TILTED_VIEW)
            setOrbiting(false)
          }}>3D</ToggleButton>
          {view.tilt !== 0 && <ToggleButton className="display btn-no-grip btn-min-square" aria-label="Orbit atlas camera" title="Drag to rotate the camera instead of panning; two fingers still pan and zoom" pressed={orbiting} onClick={() => setOrbiting(value => !value)}>Orbit</ToggleButton>}
          <IconButton className="btn-no-grip btn-min-square" variant="outline" label="Zoom out" disabled={camera.zoom <= 1} onClick={() => changeZoom(1 / 1.5)}>−</IconButton>
          <IconButton className="btn-no-grip btn-min-square" variant="outline" label="Zoom in" disabled={camera.zoom >= MAX_ATLAS_ZOOM} onClick={() => changeZoom(1.5)}>+</IconButton>
        </div>
      </div>
      {(selected || showSearch) && <aside className="atlas-inspector" aria-label={selected ? 'Selected atlas location' : 'Find atlas POI'}>
        {showSearch && <>
          <header>Finder</header>
          <Field label="Search POIs" htmlFor="atlas-poi-search">
            <TextInput className="form-mini" id="atlas-poi-search" value={search} onChange={event => setSearch(event.target.value)} />
          </Field>
          <Field label="POI category" htmlFor="atlas-poi-category">
            <Select className="form-mini" id="atlas-poi-category" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Matching locations" htmlFor="atlas-poi-location">
            <Select className="form-mini" id="atlas-poi-location" value={selectedId && landmarks.some(marker => marker.id === selectedId) ? selectedId : ''} onChange={event => {
              const marker = landmarks.find(marker => marker.id === event.target.value)
              if (marker) { setSelection([marker.id]); setSelectedId(marker.id); locate(marker.position) }
            }}>
              <option value="">Choose a POI ({landmarks.length})</option>
              {landmarks.map(marker => <option key={marker.id} value={marker.id}>{marker.label}</option>)}
            </Select>
          </Field>
          <ControlContext context="toolbar" density="compact">
            <Inline gap="sm" justify="space-between">
              <small role="status">{catalogueStatus ?? `${landmarks.length} POIs`}</small>
              <Button className="display" variant="outline" disabled={!filtersActive} onClick={() => { setSearch(''); setCategory('') }}>Clear</Button>
            </Inline>
          </ControlContext>
        </>}
        {selected && <>
        <header>
          <span>Selected location</span>
          <AddNoteButton label={`Add note for ${selected.label}`} onNavigate={onNavigate} target={atlasNoteTarget(selected)} />
        </header>
        {options.length > 1 ? <Select className="form-mini" aria-label="Locations in this group" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {options.map(marker => <option key={marker.id} value={marker.id}>{marker.kind === 'commander' ? 'You · ' : ''}{marker.label}</option>)}
        </Select> : <h2>{selected.label}</h2>}
        <dl>
          {selected.routeStop && <>
            <div><dt>Plotted route</dt><dd>{selected.routeStop.index === 0 ? 'Origin' : `Jump ${selected.routeStop.index}`}{selected.routeStop.destination ? ' · Destination' : ''}{selected.routeStop.current ? ' · Current system' : selected.routeStop.completed ? ' · Completed' : plotted.currentIndex >= 0 ? ' · Ahead' : ' · Progress unknown'}</dd></div>
            <div><dt>Star class</dt><dd>{selected.routeStop.starClass ?? 'Unknown'}</dd></div>
          </>}
          {selected.investigation && <>
            <div><dt>Activity</dt><dd>GalNet investigation · AI interpretation, not confirmed live availability</dd></div>
            <div><dt>Action</dt><dd>{selected.investigation.action}</dd></div>
            <div><dt>Reported status</dt><dd>{selected.investigation.status}</dd></div>
            <div><dt>Article</dt><dd><a href={selected.investigation.sourceUrl} target="_blank" rel="noreferrer">{selected.investigation.articleTitle ?? 'GalNet source'}</a></dd></div>
            <div><dt>Published</dt><dd><PhoenixDateTime value={selected.investigation.publishedAt} /></dd></div>
            <div><dt>Analysed</dt><dd><PhoenixDateTime value={selected.investigation.analysedAt} /> · {selected.investigation.model}</dd></div>
            <div><dt>Evidence</dt><dd>“{selected.investigation.evidence}”</dd></div>
            <div><dt>Destination evidence</dt><dd>“{selected.investigation.destinationEvidence}”</dd></div>
          </>}
          {selected.communityGoal && <>
            <div><dt>Activity</dt><dd>Community Goal</dd></div>
            <div><dt>Destination</dt><dd>{selected.communityGoal.stationName}</dd></div>
            <div><dt>Objective</dt><dd>{selected.communityGoal.objective}</dd></div>
            <div><dt>Global progress</dt><dd>{selected.communityGoal.contributed.toLocaleString('en-GB')} / {selected.communityGoal.target.toLocaleString('en-GB')}</dd></div>
            <div><dt>Expiry · Frontier time</dt><dd>{formatCommunityGoalExpiry(selected.communityGoal.expiry)}</dd></div>
            {communityGoalsSnapshot && <div><dt>Source snapshot</dt><dd><UpdatedDateTime value={communityGoalsSnapshot.fetchedAt} />{communityGoalsSnapshot.cache === 'stale' ? ' · Stale' : ''}</dd></div>}
            <div><dt>Source</dt><dd><a href="https://www.elitedangerous.com/community/goals/" target="_blank" rel="noreferrer">Frontier Community Goals</a></dd></div>
          </>}
          {selected.poi && <div><dt>Category</dt><dd>{selected.poi.categories.join(' · ')}</dd></div>}
          <div><dt>System</dt><dd><AtlasSystemLink systemName={selected.systemName} selectedName={selected.selectedName} onNavigate={onNavigate} /></dd></div>
          {selected.poi?.bodyName && <div><dt>Body</dt><dd>{selected.poi.bodyName}</dd></div>}
          {selected.poi?.siteType && <div><dt>Site type</dt><dd>{selected.poi.siteType}</dd></div>}
          {selected.poi?.surface && <div><dt>Surface coordinates · Live</dt><dd>{selected.poi.surface.latitude}°, {selected.poi.surface.longitude}°</dd></div>}
          {selected.poi?.bodyName && !selected.poi.surface && <div><dt>Surface coordinates</dt><dd>Not reported by this source</dd></div>}
          {position && <div><dt>Distance from you</dt><dd>{formatLy(distanceLy(position, selected.position))} LY</dd></div>}
          {selected.poi && <div><dt>Source</dt><dd><a href={selected.poi.sourceUrl} target="_blank" rel="noreferrer">{selected.poi.source}</a></dd></div>}
          {selected.poi?.source === 'Galactic Exploration Catalog' && <div><dt>Content licence</dt><dd><a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 3.0</a></dd></div>}
        </dl>
        {selected.kind === 'query-result' && results?.detail(selected)}
        <ControlContext context="toolbar" density="compact">
          <Inline gap="sm">
          <Button className="display" variant="outline" onClick={() => locate(selected.position, Math.min(MAX_ATLAS_ZOOM, Math.max(4, camera.zoom * 2)))}>Zoom here</Button>
          {selected.investigation && <a className="atlas-system-link" href="#/comms/galnet">Open GalNet</a>}
          {selected.communityGoal && <a className="atlas-system-link" href="#/activities/community-goals" onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onNavigate({ kind: 'information', section: 'activities', view: 'community-goals' })
          }}>Open Community Goals</a>}
          </Inline>
        </ControlContext>
        </>}
      </aside>}
      <footer className="atlas-telemetry">
        {results && <small role="status">{results.status}</small>}
        {position ? <>
          {systemName ? <AtlasSystemLink systemName={systemName} onNavigate={onNavigate} /> : <strong>Position known</strong>}
          <span>{currentRegion?.name ?? 'Outside mapped regions'}</span>
          <span>Sol · {formatLy(distanceLy(position, [0, 0, 0]))} LY</span>
          <span>{formatLy(Math.abs(position[1]))} LY {position[1] < 0 ? 'below' : 'above'} plane</span>
        </> : <Status tone="muted">Current position unavailable — waiting for journal coordinates.</Status>}
        {showBookmarks && bookmarkStatus && <small role="status">{bookmarkStatus}</small>}
        {showCommunityGoals && communityGoalsStatus && <small role="status">{communityGoalsStatus}</small>}
        {showInvestigations && investigationsStatus && <small role="status">{investigationsStatus}</small>}
        {showRoute && <small role="status">{routeStatus ?? (!navigationRoute ? 'Plotted route unavailable.' : navigationRoute.route.length === 0 ? 'No route plotted.' : `${Math.max(0, navigationRoute.route.length - 1)} plotted jumps${plotted.currentIndex < 0 ? ' · Progress unknown' : ''}${plotted.missingCoordinates ? ` · ${plotted.missingCoordinates} stops without coordinates` : ''}`)}</small>}
      </footer>
    </section>
  if (renderLayout) return renderLayout(controls, instrument)
  return results ? <div className="query-result-atlas">{controls}{instrument}</div> : <PageFrame layout="fit" className="galactic-atlas-page">
    <PageHeader title="Galactic atlas" variant="cockpit" context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/atlas' }, { label: 'Galactic atlas' }]} />} actions={controls} />
    {instrument}
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
