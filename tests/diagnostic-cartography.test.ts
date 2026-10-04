import { describe, expect, it } from 'vitest'
import { CartographicSystemSchema } from '@phoenix/contracts'
import { mockDenseCartography } from '../scripts/diagnostics/mock-dense-cartography.mjs'
import { buildSystemHierarchy } from '../apps/web/src/features/galaxy/system-hierarchy.js'
import { layoutSystemHierarchy } from '../apps/web/src/features/galaxy/system-orbital-layout.js'

describe('isolated dense cartography fixture', () => {
  it('exercises body and attached-station geometry without real provider data', () => {
    const system = CartographicSystemSchema.parse(mockDenseCartography('Diagnostic'))
    expect(system.bodies).toHaveLength(121)
    expect(system.stations).toHaveLength(40)
    expect(system.stations.filter(station => station.type === 'Fleet Carrier')).toHaveLength(20)
    const hierarchy = buildSystemHierarchy(system)
    expect(hierarchy.unassignedInstallations).toHaveLength(0)
    const layout = layoutSystemHierarchy(hierarchy.roots)
    expect(layout.nodes.length).toBeGreaterThanOrEqual(system.bodies.length)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
    expect(system.localSystem).toBeNull()
  })
})
