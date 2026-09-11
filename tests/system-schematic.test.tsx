import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { CartographicBody, CartographicSystem } from '@phoenix/contracts'
import {
  buildSystemHierarchy,
  type BodyHierarchyNode,
  type OrbitalHierarchyNode
} from '../apps/web/src/features/galaxy/system-hierarchy.js'
import { layoutSystemHierarchy } from '../apps/web/src/features/galaxy/system-orbital-layout.js'
import { SystemSchematic } from '../apps/web/src/features/galaxy/system-schematic.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('schematic cartography orders bodies by body id and preserves the complete parent hierarchy', () => {
  const system = fixtureSystem()
  system.bodies.reverse()
  const hierarchy = buildSystemHierarchy(system)

  expect(hierarchy.roots).toHaveLength(1)
  const root = expectBody(hierarchy.roots[0])
  expect(root.body.name).toBe('Sol')
  expect(root.children.map(nodeName)).toEqual(['Sol A 1', 'Sol A 2'])
  expect(expectBody(root.children[0]).children.map(nodeName)).toEqual(['Sol A 1 a'])
})

test('schematic cartography preserves complete barycentre parent chains', () => {
  const system = fixtureSystem()
  system.name = 'Test'
  system.bodies = [
    body(1, 'Test A', 'Star', 'M', [{ Null: 0 }], 0),
    body(3, 'Test B', 'Star', 'M', [{ Null: 2 }, { Null: 0 }], 43_529),
    body(4, 'Test C', 'Star', 'L', [{ Null: 2 }, { Null: 0 }], 43_601),
    body(5, 'Test A 1', 'Planet', 'Icy body', [{ Star: 1 }, { Null: 0 }], 3_186),
    body(6, 'Test B 1', 'Planet', 'Gas giant', [{ Star: 3 }, { Null: 2 }, { Null: 0 }], 43_528),
    body(7, 'Test B 2', 'Planet', 'Rocky body', [{ Star: 3 }, { Null: 2 }, { Null: 0 }], 43_559),
    body(8, 'Test BC 1', 'Planet', 'Icy body', [{ Null: 2 }, { Null: 0 }], 44_510),
    body(9, 'Test BC 1 a', 'Planet', 'Icy body', [{ Planet: 8 }, { Null: 2 }, { Null: 0 }], 44_505)
  ]

  const hierarchy = buildSystemHierarchy(system)
  expect(hierarchy.roots).toHaveLength(1)
  const systemBarycentre = hierarchy.roots[0]!
  expect(systemBarycentre).toMatchObject({ kind: 'barycentre', bodyId: 0 })
  expect(systemBarycentre.children.map(nodeName)).toEqual(['Test A', 'Barycentre 2'])
  const secondaryBarycentre = systemBarycentre.children[1]!
  expect(secondaryBarycentre).toMatchObject({ kind: 'barycentre', bodyId: 2 })
  expect(secondaryBarycentre.children.map(nodeName)).toEqual(['Test B', 'Test C', 'Test BC 1'])
  expect(expectBody(secondaryBarycentre.children[0]).children.map(nodeName)).toEqual(['Test B 1', 'Test B 2'])
  expect(expectBody(secondaryBarycentre.children[2]).children.map(nodeName)).toEqual(['Test BC 1 a'])

  const layout = layoutSystemHierarchy(hierarchy.roots)
  const positions = new Map(layout.nodes.map(item => [nodeName(item.node), item]))
  expect(positions.get('Test A 1')?.x).toBeGreaterThan(positions.get('Test A')!.x)
  expect(positions.get('Test A 1')?.y).toBe(positions.get('Test A')?.y)
  expect(positions.get('Test B')?.x).toBe(positions.get('Test C')?.x)
  expect(positions.get('Test BC 1')!.y).toBeGreaterThan(positions.get('Test B')!.y)
  expect(positions.get('Test C')!.y).toBeGreaterThan(positions.get('Test BC 1')!.y)
  expect(positions.get('Test C')!.y).toBeGreaterThan(positions.get('Test B')!.y)
  expect(positions.get('Test B 1')?.x).toBeGreaterThan(positions.get('Test B')!.x)
  expect(positions.get('Test B 2')?.x).toBeGreaterThan(positions.get('Test B 1')!.x)
  expect(positions.get('Test B 1')?.y).toBe(positions.get('Test B')?.y)
  expect(positions.get('Test BC 1 a')?.x).toBe(positions.get('Test BC 1')?.x)
  expect(positions.get('Test BC 1 a')!.y).toBeGreaterThan(positions.get('Test BC 1')!.y)
  expect(new Set(layout.nodes.map(item => `${item.x}:${item.y}`))).toHaveLength(layout.nodes.length)

  const markup = renderToStaticMarkup(
    <SystemSchematic onSelect={vi.fn()} system={system} />
  )
  expect(markup).not.toContain('system-barycentre-junction')
  expect(markup).toContain('>BC 1 a</strong>')
  expect(markup).not.toContain('>1 a</strong>')
})

test('schematic cartography recursively lays out a binary planet pair within a stellar orbit', () => {
  const system = fixtureSystem()
  system.name = 'Binary'
  system.bodies = [
    body(0, 'Binary', 'Star', 'G', [], 0),
    body(2, 'Binary 1 a', 'Planet', 'Rocky body', [{ Null: 1 }, { Star: 0 }], 100),
    body(3, 'Binary 1 b', 'Planet', 'Rocky body', [{ Null: 1 }, { Star: 0 }], 101),
    body(4, 'Binary 1 a a', 'Planet', 'Icy body', [{ Planet: 2 }, { Null: 1 }, { Star: 0 }], 100.1)
  ]
  const hierarchy = buildSystemHierarchy(system)
  const star = expectBody(hierarchy.roots[0])
  const binary = star.children[0]!

  expect(binary).toMatchObject({ kind: 'barycentre', bodyId: 1 })
  expect(binary.children.map(nodeName)).toEqual(['Binary 1 a', 'Binary 1 b'])
  expect(expectBody(binary.children[0]).children.map(nodeName)).toEqual(['Binary 1 a a'])

  const positions = new Map(layoutSystemHierarchy(hierarchy.roots).nodes.map(item => [nodeName(item.node), item]))
  expect(positions.has('Barycentre 1')).toBe(false)
  expect(positions.get('Binary 1 b')!.x).toBeGreaterThan(positions.get('Binary 1 a')!.x)
  expect(positions.get('Binary 1 a')?.y).toBe(positions.get('Binary 1 b')?.y)
  expect(positions.get('Binary 1 a a')?.x).toBe(positions.get('Binary 1 a')?.x)
})

test('schematic cartography composes nested planetary and lunar barycentres', () => {
  const system = fixtureSystem()
  system.name = 'StKM 1-1964'
  system.bodies = [
    body(0, 'StKM 1-1964', 'Star', 'K', [], 0),
    body(8, 'StKM 1-1964 1', 'Planet', 'Gas giant', [{ Null: 7 }, { Star: 0 }], 766),
    body(11, 'StKM 1-1964 1 a', 'Planet', 'Rocky body', [{ Planet: 8 }, { Null: 7 }, { Star: 0 }], 766),
    body(14, 'StKM 1-1964 1 c', 'Planet', 'Rocky body', [{ Null: 13 }, { Planet: 8 }, { Null: 7 }, { Star: 0 }], 770),
    body(15, 'StKM 1-1964 1 d', 'Planet', 'Rocky body', [{ Null: 13 }, { Planet: 8 }, { Null: 7 }, { Star: 0 }], 770),
    body(18, 'StKM 1-1964 2', 'Planet', 'Gas giant', [{ Null: 7 }, { Star: 0 }], 762),
    body(21, 'StKM 1-1964 2 a', 'Planet', 'Icy body', [{ Planet: 18 }, { Null: 7 }, { Star: 0 }], 762)
  ]

  const layout = layoutSystemHierarchy(buildSystemHierarchy(system).roots)
  const positions = new Map(layout.nodes.map(item => [nodeName(item.node), item]))

  expect(positions.has('Barycentre 7')).toBe(false)
  expect(positions.get('StKM 1-1964 2')!.x).toBeGreaterThan(positions.get('StKM 1-1964 1')!.x)
  expect(positions.get('StKM 1-1964 1')?.y).toBe(positions.get('StKM 1-1964 2')?.y)
  expect(positions.get('StKM 1-1964 1 a')?.x).toBe(positions.get('StKM 1-1964 1')?.x)
  expect(positions.get('StKM 1-1964 1 a')!.y).toBeGreaterThan(positions.get('StKM 1-1964 1')!.y)
  expect(positions.has('Barycentre 13')).toBe(false)
  expect(positions.get('StKM 1-1964 1 d')!.x).toBeGreaterThan(positions.get('StKM 1-1964 1 c')!.x)
  expect(positions.get('StKM 1-1964 1 c')?.y).toBe(positions.get('StKM 1-1964 1 d')?.y)
  expect(new Set(layout.nodes.map(item => `${item.x}:${item.y}`))).toHaveLength(layout.nodes.length)
  expect(layout.edges.flatMap(edge => edge.points.slice(1).map((point, index) => {
    const previous = edge.points[index]!
    return point.x === previous.x || point.y === previous.y
  }))).not.toContain(false)
})

test('schematic cartography aligns circumbinary orbital branches without rendering barycentres', () => {
  const system = fixtureSystem()
  system.name = 'Smoje TO-Z d13-40'
  system.stations = []
  system.bodies = [
    body(1, 'Smoje TO-Z d13-40 A', 'Star', 'F', [{ Null: 0 }], 0),
    body(2, 'Smoje TO-Z d13-40 B', 'Star', 'K', [{ Null: 0 }], 933),
    body(3, 'Smoje TO-Z d13-40 A 1', 'Planet', 'Metal-rich body', [{ Star: 1 }, { Null: 0 }], 46),
    body(4, 'Smoje TO-Z d13-40 A 2', 'Planet', 'High metal content world', [{ Star: 1 }, { Null: 0 }], 62),
    body(5, 'Smoje TO-Z d13-40 B 1', 'Planet', 'Metal-rich body', [{ Star: 2 }, { Null: 0 }], 850),
    body(6, 'Smoje TO-Z d13-40 B 2', 'Planet', 'High metal content world', [{ Star: 2 }, { Null: 0 }], 889),
    body(11, 'Smoje TO-Z d13-40 AB 1', 'Planet', 'Class III gas giant', [{ Null: 10 }, { Null: 0 }], 1_573),
    body(13, 'Smoje TO-Z d13-40 AB 1 a', 'Planet', 'Rocky body', [{ Planet: 11 }, { Null: 10 }, { Null: 0 }], 1_575),
    body(15, 'Smoje TO-Z d13-40 AB 2', 'Planet', 'Class III gas giant', [{ Null: 10 }, { Null: 0 }], 1_572),
    body(18, 'Smoje TO-Z d13-40 AB 2 a', 'Planet', 'Rocky body', [{ Planet: 15 }, { Null: 10 }, { Null: 0 }], 1_572),
    body(20, 'Smoje TO-Z d13-40 AB 3', 'Planet', 'Class III gas giant', [{ Null: 0 }], 2_165),
    body(22, 'Smoje TO-Z d13-40 AB 3 a', 'Planet', 'Icy body', [{ Planet: 20 }, { Null: 0 }], 2_195)
  ]

  const layout = layoutSystemHierarchy(buildSystemHierarchy(system).roots)
  const positions = new Map(layout.nodes.map(item => [nodeName(item.node), item]))

  expect([...positions.keys()].some(name => name.startsWith('Barycentre'))).toBe(false)
  expect(positions.get('Smoje TO-Z d13-40 A')?.x).toBe(positions.get('Smoje TO-Z d13-40 B')?.x)
  expect(positions.get('Smoje TO-Z d13-40 B')!.y).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 A')!.y)
  expect(positions.get('Smoje TO-Z d13-40 A 2')!.x).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 A 1')!.x)
  expect(positions.get('Smoje TO-Z d13-40 A 1')?.y).toBe(positions.get('Smoje TO-Z d13-40 A')?.y)
  expect(positions.get('Smoje TO-Z d13-40 B 2')!.x).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 B 1')!.x)
  expect(positions.get('Smoje TO-Z d13-40 B 1')?.y).toBe(positions.get('Smoje TO-Z d13-40 B')?.y)
  expect(positions.get('Smoje TO-Z d13-40 AB 1')?.y).toBe(positions.get('Smoje TO-Z d13-40 AB 2')?.y)
  expect(positions.get('Smoje TO-Z d13-40 AB 2')?.y).toBe(positions.get('Smoje TO-Z d13-40 AB 3')?.y)
  expect(positions.get('Smoje TO-Z d13-40 AB 1')?.x).toBe(positions.get('Smoje TO-Z d13-40 A 1')?.x)
  expect(positions.get('Smoje TO-Z d13-40 AB 1')!.y).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 A')!.y)
  expect(positions.get('Smoje TO-Z d13-40 B')!.y).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 AB 1')!.y)
  expect(positions.get('Smoje TO-Z d13-40 AB 1')!.y - positions.get('Smoje TO-Z d13-40 A')!.y)
    .toBeGreaterThan(positions.get('Smoje TO-Z d13-40 AB 1 a')!.y - positions.get('Smoje TO-Z d13-40 AB 1')!.y)
  expect(positions.get('Smoje TO-Z d13-40 AB 2')!.x).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 AB 1')!.x)
  expect(positions.get('Smoje TO-Z d13-40 AB 3')!.x).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 AB 2')!.x)
  expect(positions.get('Smoje TO-Z d13-40 AB 1 a')?.x).toBe(positions.get('Smoje TO-Z d13-40 AB 1')?.x)
  expect(positions.get('Smoje TO-Z d13-40 AB 1 a')!.y).toBeGreaterThan(positions.get('Smoje TO-Z d13-40 AB 1')!.y)
  expect(Math.min(...layout.edges.flatMap(edge => edge.points.map(point => point.x)))).toBeCloseTo(0.1)
})

test('schematic cartography connects nested invisible barycentre axes without gaps', () => {
  const system = fixtureSystem()
  system.name = 'Mals'
  system.stations = []
  system.bodies = [
    body(2, 'Mals A', 'Star', 'M', [{ Null: 1 }, { Null: 0 }], 0),
    body(4, 'Mals B', 'Star', 'L', [{ Null: 3 }, { Null: 1 }, { Null: 0 }], 403),
    body(5, 'Mals C', 'Star', 'T', [{ Null: 3 }, { Null: 1 }, { Null: 0 }], 364),
    body(6, 'Mals D', 'Star', 'L', [{ Null: 0 }], 183_803)
  ]

  const layout = layoutSystemHierarchy(buildSystemHierarchy(system).roots)
  const outerConnection = layout.edges.find(edge => edge.key === 'barycentre:0:barycentre:1')
  const innerConnection = layout.edges.find(edge => edge.key === 'barycentre:1:body:2')

  expect(outerConnection?.points.at(-1)).toEqual(innerConnection?.points[0])
})

test('schematic cartography preserves unresolved ancestors while live scans are incomplete', () => {
  const system = fixtureSystem()
  system.bodies = [
    body(2, 'Partial 1', 'Planet', 'Rocky body', [{ Star: 0 }], 100)
  ]

  const hierarchy = buildSystemHierarchy(system)
  expect(hierarchy.roots).toHaveLength(1)
  expect(hierarchy.roots[0]).toMatchObject({
    kind: 'unresolved-body',
    bodyId: 0,
    bodyType: 'Star',
    children: [{ kind: 'body', body: { name: 'Partial 1' } }]
  })

  const positions = new Map(layoutSystemHierarchy(hierarchy.roots).nodes.map(item => [nodeName(item.node), item]))
  expect(positions.get('Partial 1')?.x).toBeGreaterThan(positions.get('Star 0')!.x)
  expect(positions.get('Partial 1')?.y).toBe(positions.get('Star 0')?.y)
})

test('schematic cartography prefers reported installation parents and otherwise uses nearest-body distance', () => {
  const system = fixtureSystem()
  system.stations.push({
    ...system.stations[0]!,
    id: 2,
    marketId: 2,
    name: 'Solar Carrier',
    type: 'Fleet Carrier',
    distanceToArrival: 0,
    raw: {}
  })
  const hierarchy = buildSystemHierarchy(system)
  const root = expectBody(hierarchy.roots[0])

  expect(root.installations.map(item => [item.station.name, item.source])).toEqual([['Solar Carrier', 'distance']])
  expect(root.children[0]?.installations.map(item => [item.station.name, item.source])).toEqual([['Galileo', 'explicit']])
  expect(hierarchy.unassignedInstallations).toEqual([])
})

test('schematic cartography infers ordinary starports from planets rather than nearby stars', () => {
  const system = fixtureSystem()
  system.bodies = [
    body(0, 'Sol A', 'Star', 'G', [], 100),
    body(1, 'Sol A 1', 'Planet', 'Rocky body', [{ Star: 0 }], 80),
    body(2, 'Sol A 2', 'Planet', 'Rocky body', [{ Star: 0 }], 130)
  ]
  system.stations = [{
    ...system.stations[0]!,
    distanceToArrival: 120,
    raw: {}
  }]

  const hierarchy = buildSystemHierarchy(system)
  const star = expectBody(hierarchy.roots[0])

  expect(star.installations).toEqual([])
  expect(expectBody(star.children[0]).installations).toEqual([])
  expect(expectBody(star.children[1]).installations.map(item => item.station.name)).toEqual(['Galileo'])
})

test('schematic cartography renders symbolic bodies, stations, and scan markers', () => {
  const system = fixtureSystem()
  const selected = system.bodies[1]!
  selected.details = {
    ...selected.details,
    atmosphereComposition: [{ name: 'Nitrogen', percent: 78 }],
    massEarths: 1,
    surfacePressurePascals: 101_325,
    terraformState: 'Not terraformable',
    volcanism: 'None'
  }
  const markup = renderToStaticMarkup(
    <SystemSchematic
      commanderName="Ellan Murdock"
      onSelect={vi.fn()}
      selected={selected}
      system={system}
    />
  )

  expect(markup).toContain('Schematic map of Sol')
  expect(markup).toContain('system-body--star')
  expect(markup).toContain('system-body--earthlike')
  expect(markup).toContain('system-body--child')
  expect(markup).toContain('Biological signals')
  expect(markup).toContain('Ellan Murdock')
  expect(markup).toContain('First footfall')
  expect(markup).toContain('Unclaimed when scanned')
  expect(markup).toContain('Atmosphere composition')
  expect(markup).toContain('Nitrogen 78%')
  expect(markup).toContain('Not terraformable')
  expect(markup).toContain('Galileo')
  expect(markup).toContain('Installation')
  expect(markup).not.toContain('System summary')
  expect(markup).toContain('has-selection')
})

test('schematic cartography omits planetary survey fields for stars', () => {
  const system = fixtureSystem()
  const selected = system.bodies[0]!
  selected.subType = 'N'
  selected.surfaceTemperatureKelvin = 1_000_000
  selected.radiusKilometres = 10
  selected.details = { ...selected.details, isScoopable: false, solarMasses: 1.4, spectralClass: 'N', tidallyLocked: false }
  const markup = renderToStaticMarkup(
    <SystemSchematic
      commanderName="Ellan Murdock"
      onSelect={vi.fn()}
      selected={selected}
      system={system}
    />
  )
  const sidebar = markup.match(/<aside class="cartography-detail">.*<\/aside>/)?.[0]

  expect(sidebar).toBeDefined()
  expect(sidebar).toContain('Neutron Star')
  expect(sidebar).toContain('<dt>Scoopable</dt><dd>No</dd>')
  expect(sidebar).toContain('<h3>Star</h3>')
  expect(sidebar).toContain('<dt>Mass</dt><dd>1.4 M☉</dd>')
  expect(sidebar).toContain('<dt>Temperature</dt><dd>1,000,000 K</dd>')
  expect(sidebar).toContain('<dt>Radius</dt><dd>10 km</dd>')
  expect(sidebar).toContain('<dt>Tidal lock</dt><dd>No</dd>')
  expect(sidebar).not.toContain('<h3>Environment</h3>')
  expect(sidebar).toContain('Scanned')
  expect(sidebar).toContain('First discovered')
  expect(sidebar).not.toContain('<dt>Landable</dt>')
  expect(sidebar).not.toContain('<dt>Mapped</dt>')
  expect(sidebar).not.toContain('<dt>Set foot</dt>')
  expect(sidebar).not.toContain('<dt>First mapped</dt>')
  expect(sidebar).not.toContain('<dt>First footfall</dt>')
})

test('schematic cartography uses the full map workspace until an object is selected', () => {
  const markup = renderToStaticMarkup(
    <SystemSchematic
      onSelect={vi.fn()}
      system={fixtureSystem()}
    />
  )

  expect(markup).toContain('class="system-cartography"')
  expect(markup).not.toContain('has-selection')
  expect(markup).not.toContain('cartography-detail')
})

test('schematic zoom changes the orbital canvas scale and resets to 100 percent', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<SystemSchematic onSelect={vi.fn()} system={fixtureSystem()} />)
  })

  const orbitalViewport = () => renderer.root.findByProps({ className: 'system-orbital-layout' })
  const orbitalCanvas = () => renderer.root.findByProps({ className: 'system-orbital-layout__canvas' })
  const originalInlineSize = orbitalViewport().props.style.inlineSize

  await act(async () => renderer.root.findByProps({ 'aria-label': 'Zoom in' }).props.onClick())
  expect(renderer.root.findByProps({ 'aria-label': 'Reset zoom to 100%' }).props.children.join('')).toBe('125%')
  expect(orbitalViewport().props.style.inlineSize).not.toBe(originalInlineSize)
  expect(orbitalCanvas().props.style.transform).toBe('scale(1.25)')

  await act(async () => renderer.update(
    <SystemSchematic onSelect={vi.fn()} selected={fixtureSystem().bodies[1]} system={fixtureSystem()} />
  ))
  expect(renderer.root.findByProps({ 'aria-label': 'Reset zoom to 100%' }).props.children.join('')).toBe('125%')

  await act(async () => renderer.root.findByProps({ 'aria-label': 'Reset zoom to 100%' }).props.onClick())
  expect(renderer.root.findByProps({ 'aria-label': 'Reset zoom to 100%' }).props.children.join('')).toBe('100%')
  expect(orbitalViewport().props.style.inlineSize).toBe(originalInlineSize)
  expect(orbitalCanvas().props.style.transform).toBe('scale(1)')

  await act(async () => renderer.unmount())
})

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 5,
    name: 'Sol',
    address: 10477373803,
    position: [0, 0, 0],
    permitRequired: false,
    permitName: null,
    information: {
      allegiance: 'Federation',
      government: 'Democracy',
      security: 'High',
      state: null,
      primaryEconomy: 'Service',
      secondaryEconomy: null,
      population: 23_000_000_000,
      controllingFaction: 'Mother Gaia'
    },
    primaryStar: null,
    bodies: [
      body(0, 'Sol', 'Star', 'G (White-Yellow) Star', [], 0),
      body(1, 'Sol A 1', 'Planet', 'Earth-like world', [{ Star: 0 }], 500, true),
      body(2, 'Sol A 1 a', 'Planet', 'Rocky body', [{ Planet: 1 }, { Star: 0 }], 501),
      body(3, 'Sol A 2', 'Planet', 'Gas giant with water-based life', [{ Star: 0 }], 900)
    ],
    stations: [{
      id: 1,
      marketId: 128666762,
      name: 'Galileo',
      type: 'Coriolis Starport',
      distanceToArrival: 502,
      allegiance: 'Federation',
      government: 'Democracy',
      economy: 'Service',
      secondEconomy: null,
      controllingFaction: 'Mother Gaia',
      services: ['Repair'],
      facilities: { market: true, shipyard: true, outfitting: true },
      raw: { body: { id: 1, name: 'Sol A 1' } }
    }],
    scanProgress: { knownBodies: 4, reportedBodies: 4, percent: 100 },
    localSystem: null,
    provenance: { edsm: { fetchedAt: '2026-08-11T20:00:00.000Z' }, journal: null },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}

function expectBody (node: OrbitalHierarchyNode | undefined): BodyHierarchyNode {
  expect(node?.kind).toBe('body')
  return node as BodyHierarchyNode
}

function nodeName (node: OrbitalHierarchyNode): string {
  if (node.kind === 'body') return node.body.name
  if (node.kind === 'barycentre') return `Barycentre ${node.bodyId}`
  return `${node.bodyType} ${node.bodyId}`
}

function body (
  bodyId: number,
  name: string,
  type: string,
  subType: string,
  parents: Record<string, unknown>[],
  distanceToArrival: number,
  local = false
): CartographicBody {
  return {
    id: bodyId,
    id64: bodyId + 10,
    bodyId,
    name,
    type,
    subType,
    distanceToArrival,
    parents,
    landable: null,
    gravityGs: null,
    surfaceTemperatureKelvin: null,
    radiusKilometres: null,
    atmosphere: null,
    ringed: false,
    details: emptyDetails(),
    firstDiscoveredBy: null,
    firstFootfallBy: null,
    firstMappedBy: null,
    local: local
      ? {
          observedAt: '2026-08-11T20:00:00.000Z',
          discovered: true,
          footfalled: false,
          mapped: true,
          firstDiscoveredByCommander: true,
          firstMappedByCommander: true,
          previouslyFootfalled: false,
          surfaceScanCompleted: true,
          signals: { biological: 2, geological: 0, human: 0 },
          signalDetails: [{ type: 'Biological', count: 2 }],
          biologicalGenuses: ['Bacterium'],
          organicSamples: [],
          raw: { scan: null, bodySignals: null, surfaceSignals: null }
        }
      : null,
    raw: {}
  }
}

function emptyDetails (): CartographicBody['details'] {
  return {
    absoluteMagnitude: null, ageMillionYears: null, atmosphereComposition: [], isMainStar: null, isScoopable: null,
    luminosity: null, massEarths: null, materials: [], orbit: { ascendingNodeDegrees: null, axialTiltDegrees: null, eccentricity: null, inclinationDegrees: null, meanAnomalyDegrees: null, orbitalPeriodSeconds: null, periapsisDegrees: null, rotationPeriodSeconds: null, semiMajorAxisKilometres: null },
    reserveLevel: null, rings: [], scanType: null, solarMasses: null, solarRadius: null, solidComposition: null,
    spectralClass: null, starSubclass: null, surfacePressurePascals: null, terraformState: null, tidallyLocked: null, volcanism: null
  }
}
