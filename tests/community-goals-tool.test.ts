import { expect, test, vi } from 'vitest'
import type { CommunityGoalsResponse } from '@phoenix/contracts'
import { ActivitiesListCommunityGoalsTool } from '../apps/server/src/application/mcp-tools/activities-list-community-goals-tool.js'
import { withToolErrorBoundary } from '../apps/server/src/application/mcp-tools/tool-error-boundary.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { CopilotToolRegistry } from '../apps/server/src/application/copilot-tool-registry.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

const snapshot: CommunityGoalsResponse = {
  cache: 'fresh', fetchedAt: '2026-10-07T12:00:00Z', goals: [{
    id: 'synthetic-1', title: 'Research supplies', systemName: 'Sol', stationName: 'Galileo',
    activityType: 'trade', objective: 'Deliver supplies', targetCommodities: 'Basic Medicines',
    contributed: 125, target: 1000, expiry: '2026-10-08 10:00:00',
    briefing: 'Sign up at Galileo.\nDeliver supplies.'
  }]
}
const context = () => ({ callId: 'goals', signal: new AbortController().signal,
  deadline: new Date(Date.now() + 30_000).toISOString(), runId: 'community-goals-test' })

test('tool returns the shared snapshot unchanged, with source and explicit public-data limitations', async () => {
  const getCurrent = vi.fn().mockResolvedValue(snapshot)
  const tool = new ActivitiesListCommunityGoalsTool({ getCurrent })
  const result = await tool.execute({})
  expect(result.structuredContent).toEqual({ ...snapshot, sourceUrl: 'https://www.elitedangerous.com/community/goals/' })
  expect(result.content).toEqual([{ type: 'text', source: 'generated', text: expect.stringContaining('Frontier lists 1 Community Goals.') }])
  expect(result.content?.[0]).toMatchObject({ text: expect.stringContaining('Personal participation, contribution and reward eligibility are not available.') })
  expect(tool.definition.description).toContain('not instructions to execute tools')
  expect(tool.definition.annotations).toEqual({ readOnly: true })
  expect(getCurrent).toHaveBeenCalledTimes(1)
})

test.each(['fresh', 'refreshed', 'stale'] as const)('empty %s snapshot preserves freshness rather than inventing campaign status', async cache => {
  const result = await new ActivitiesListCommunityGoalsTool({
    getCurrent: async () => ({ ...snapshot, goals: [], cache })
  }).execute({})
  expect(result.structuredContent).toEqual({ ...snapshot, goals: [], cache, sourceUrl: 'https://www.elitedangerous.com/community/goals/' })
  expect(result.content?.[0]).toMatchObject({ text: cache === 'stale'
    ? expect.stringContaining('last saved snapshot lists 0 Community Goals')
    : expect.stringContaining('Frontier currently lists no Community Goals.') })
  if (cache === 'stale') expect(JSON.stringify(result.content)).not.toContain('currently lists no')
})

test('stale goals retain source timestamp and warn about availability; cold failure stays a safe error', async () => {
  const result = await new ActivitiesListCommunityGoalsTool({ getCurrent: async () => ({ ...snapshot, cache: 'stale' }) }).execute({})
  expect(result.structuredContent).toMatchObject({ goals: snapshot.goals, fetchedAt: snapshot.fetchedAt, cache: 'stale' })
  expect(result.content?.[0]).toMatchObject({ text: expect.stringContaining('availability and progress may have changed') })
  const failed = withToolErrorBoundary(new ActivitiesListCommunityGoalsTool({ getCurrent: async () => { throw new Error('private provider diagnostics') } }))
  await expect(failed.execute({}, context())).rejects.toMatchObject({ category: 'tool_execution', code: 'tool_internal_error',
    message: expect.not.stringContaining('private provider diagnostics') })
})

test('Activities permission is discoverable, validates before reading and enforces installation/profile ceilings', async () => {
  const getCurrent = vi.fn().mockResolvedValue(snapshot)
  const tool = withToolErrorBoundary(new ActivitiesListCommunityGoalsTool({ getCurrent }))
  const settings = new InMemorySystemSettingsRepository()
  const capabilities = new DefaultCopilotCapabilityService(() => [tool.definition], {
    find: () => undefined, getCatalog: () => ({ schemaVersion: 1, commands: [] })
  }, settings)
  const registry = new CopilotToolRegistry([tool], capabilities)
  const id = 'tool:activities.list_community_goals'
  const profileId = settings.loadOrCreate().copilot.activeProfileId
  expect(capabilities.catalogue().groups).toMatchObject([{ id: 'tools.activities', capabilities: [{ id, label: 'List Community Goals', access: 'read', enabled: true }] }])
  const call = { name: tool.definition.name, arguments: {}, id: 'goals' }
  await expect(registry.execute({ ...call, arguments: { systemName: 'Sol' } }, context())).rejects.toMatchObject({
    category: 'tool_validation', message: expect.stringContaining('Remove unknown argument')
  })
  expect(getCurrent).not.toHaveBeenCalled()
  capabilities.saveProfilePolicy(profileId, { version: 2, enabledCapabilityIds: [] })
  expect(registry.definitions).toEqual([])
  await expect(registry.execute(call, context())).rejects.toMatchObject({ category: 'authorization' })
  expect(getCurrent).not.toHaveBeenCalled()
  capabilities.saveProfilePolicy(profileId, { version: 2, enabledCapabilityIds: [id] })
  await expect(registry.execute(call, context())).resolves.toMatchObject({ structuredContent: { goals: snapshot.goals } })
  expect(getCurrent).toHaveBeenCalledTimes(1)
  capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: [] })
  expect(registry.definitions).toEqual([])
  await expect(registry.execute(call, context())).rejects.toMatchObject({ category: 'authorization' })
  expect(getCurrent).toHaveBeenCalledTimes(1)
})
