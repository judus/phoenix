import { expect, test, vi } from 'vitest'
import { SpanshFactionPresenceSource } from '../apps/server/src/infrastructure/spansh-faction-presence-source.js'
import type { FactionPresenceRequest } from '../apps/server/src/domain/station-market.js'
import { FactionsSearchTool } from '../apps/server/src/application/mcp-tools/factions-search-tool.js'

const request: FactionPresenceRequest = {
  allegiance: null, controlling: 'any', factionName: null, government: null,
  maxDistanceLy: 100, minInfluencePercent: 0, referencePosition: [0, 0, 0],
  state: null, states: ['War', 'Civil War']
}
const faction = (name: string, state: string, influence = 0.2) => ({
  name, state, influence, allegiance: 'Federation', government: 'Democracy',
  active_states: [state], pending_states: [], recovering_states: []
})
const system = {
  name: 'Example', distance: 10, x: 1, y: 2, z: 3, id64: 123,
  controlling_minor_faction: 'Peaceful controller', updated_at: '2026-09-27T12:00:00Z',
  minor_faction_presences: [
    faction('Peaceful controller', 'Boom'), faction('War faction', 'War'),
    faction('Civil war faction', 'Civil War'), faction('Pending only', 'None')
  ]
}

test('searches any faction with OR states and returns all matching non-controlling factions', async () => {
  const search = vi.fn(async () => [system])
  const source = new SpanshFactionPresenceSource({ search, findFieldValues: async () => [] })
  const results = await source.findFactionPresences(request)
  expect(results.map(row => row.factionName)).toEqual(['War faction', 'Civil war faction'])
  expect(results.every(row => !row.controlling && row.updatedAt === '2026-09-27T12:00:00.000Z')).toBe(true)
  expect(search.mock.calls[0]?.[1].filters).toEqual({
    distance: { min: '0', max: '100' },
    minor_faction_presences: [{ influence: { comparison: '<=>', value: [0, 1] }, state: { value: ['War', 'Civil War'] } }]
  })
})

test('applies all filters to the same faction, respects control and excludes out-of-range systems', async () => {
  const source = new SpanshFactionPresenceSource({ search: async () => [system, { ...system, distance: 101 }], findFieldValues: async () => [] })
  expect(await source.findFactionPresences({ ...request, controlling: 'yes' })).toEqual([])
  expect(await source.findFactionPresences({ ...request, allegiance: 'Empire' })).toEqual([])
  expect(await source.findFactionPresences({ ...request, government: 'Anarchy' })).toEqual([])
  expect(await source.findFactionPresences({ ...request, minInfluencePercent: 30 })).toEqual([])
  expect(await source.findFactionPresences({ ...request, factionName: 'war faction' })).toHaveLength(1)
  expect(await source.findFactionPresences({ ...request, states: [], controlling: 'yes' })).toHaveLength(1)
  expect(await source.findFactionPresences({ ...request, states: undefined, state: 'War' })).toHaveLength(1)
})

test('MCP accepts state search without a faction name', async () => {
  const searchFactionPresences = vi.fn(async () => ({ content: [] }))
  const tool = new FactionsSearchTool({ searchFactionPresences })
  expect(tool.definition.inputSchema).not.toHaveProperty('required')
  await tool.execute({ states: ['War', 'Civil War'] })
  expect(searchFactionPresences).toHaveBeenCalledWith({ states: ['War', 'Civil War'] })
})
