import { expect, test, vi } from 'vitest'
import { AiError, ToolRegistry, ToolUsageError, serializeAiError, type JsonObject, type LocalTool } from '@jdu/llm-client'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { DisplayCommandService } from '../apps/server/src/application/display-command-service.js'
import { DefaultExplorationTargetQuery } from '../apps/server/src/application/default-exploration-target-query.js'
import { DefaultStationMarketQuery } from '../apps/server/src/application/default-station-market-query.js'
import { DisplayOpenPageTool } from '../apps/server/src/application/mcp-tools/display-open-page-tool.js'
import { DisplayShowSystemTool } from '../apps/server/src/application/mcp-tools/display-show-system-tool.js'
import { ExplorationSearchTargetsTool } from '../apps/server/src/application/mcp-tools/exploration-search-targets-tool.js'
import { SystemsSearchTool } from '../apps/server/src/application/mcp-tools/systems-search-tool.js'
import { withToolErrorBoundary } from '../apps/server/src/application/mcp-tools/tool-error-boundary.js'
import type { ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'

test('Copilot prospecting guidance uses the cutoff and unconstrained landability/signal semantics', async () => {
  const { execute, findTargets } = explorationFixture()
  const description = new ExplorationSearchTargetsTool({ searchTargets: vi.fn() }).definition.inputSchema.properties.lastReportedBefore.description
  for (const wording of ['2021-05-18', 'landable="any"', 'minBiologicalSignals=0', 'not exactly zero', 'do not prove']) expect(description).toContain(wording)
  expect(description).not.toContain('2021-05-19')
  await execute({ lastReportedBefore: '2021-05-18', landable: 'any', minBiologicalSignals: 0 })
  expect(findTargets).toHaveBeenCalledWith(expect.objectContaining({ lastReportedBefore: '2021-05-18', landable: 'any', minBiologicalSignals: 0 }))
})

test('display system correction stops publishing until an explicit system is supplied', async () => {
  const publish = vi.fn()
  const display = new DisplayCommandService({ publish, subscribe: () => () => {} }, new InMemoryRuntimeStateStore())
  const execute = toolExecutor(new DisplayShowSystemTool(display))
  await expect(execute({})).rejects.toMatchObject({
    name: 'ToolUsageError', category: 'tool_validation', retryable: false,
    message: expect.stringContaining('Correction: Provide systemName explicitly')
  })
  expect(publish).not.toHaveBeenCalled()
  await expect(execute({ systemName: 'Sol' })).resolves.toMatchObject({ structuredContent: { displayed: true, systemName: 'Sol' } })
  expect(publish).toHaveBeenCalledTimes(1)
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'show_system', systemName: 'Sol' }))
})

test('unknown display page returns canonical suggestions without reflecting arbitrary input', async () => {
  const publish = vi.fn()
  const display = new DisplayCommandService({ publish, subscribe: () => () => {} }, new InMemoryRuntimeStateStore())
  const execute = toolExecutor(new DisplayOpenPageTool(display))
  const failure = await execute({ page: 'private-input-that-is-not-a-page' }).catch(cause => cause)
  expect(failure).toBeInstanceOf(ToolUsageError)
  expect(failure).toMatchObject({ category: 'tool_validation', retryable: false, message: expect.stringContaining('galaxy.system') })
  expect(JSON.stringify(serializeAiError(failure))).not.toContain('private-input-that-is-not-a-page')
  expect(publish).not.toHaveBeenCalled()
  await expect(execute({ page: 'galaxy.system' })).resolves.toMatchObject({ structuredContent: { displayed: true, pageId: 'galaxy.system' } })
  expect(publish).toHaveBeenCalledTimes(1)
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'open_page', pageId: 'galaxy.system' }))
})

test.each([
  { invalid: { minGravityG: 1, maxGravityG: 0.27 }, corrected: { minGravityG: 0, maxGravityG: 0.27 }, hint: 'Lower minGravityG' },
  { invalid: { minTemperatureK: 300, maxTemperatureK: 200 }, corrected: { minTemperatureK: 150, maxTemperatureK: 200 }, hint: 'Lower minTemperatureK' },
  { invalid: { lastReportedBefore: '2026-02-30' }, corrected: { lastReportedBefore: '2026-02-28' }, hint: 'real calendar date' }
])('exploration domain correction ($hint) avoids the provider and accepts a corrected query', async ({ invalid, corrected, hint }) => {
  const { execute, findTargets, getSystem } = explorationFixture()
  await expect(execute(invalid)).rejects.toMatchObject({ category: 'tool_validation', retryable: false, message: expect.stringContaining(hint) })
  expect(findTargets).not.toHaveBeenCalled()
  expect(getSystem).not.toHaveBeenCalled()
  await expect(execute(corrected)).resolves.toMatchObject({ structuredContent: { originSystem: 'Sol', targets: [] } })
  expect(findTargets).toHaveBeenCalledTimes(1)
  expect(findTargets).toHaveBeenCalledWith(expect.objectContaining(corrected))
})

test('exploration unknown current identity needs an explicit system before provider execution', async () => {
  const { execute, findTargets, getSystem } = explorationFixture(false)
  await expect(execute({})).rejects.toMatchObject({ category: 'tool_validation', retryable: false, message: expect.stringContaining('Provide systemName explicitly') })
  expect(findTargets).not.toHaveBeenCalled()
  expect(getSystem).not.toHaveBeenCalled()
  await expect(execute({ systemName: 'Sol' })).resolves.toMatchObject({ structuredContent: { originSystem: 'Sol' } })
  expect(getSystem).toHaveBeenCalledTimes(1)
  expect(findTargets).toHaveBeenCalledTimes(1)
})

test('exploration missing coordinates gives safe correction and does not query targets', async () => {
  const { execute, findTargets, getSystem } = explorationFixture()
  const failure = await execute({ systemName: 'private-unknown-system' }).catch(cause => cause)
  expect(failure).toBeInstanceOf(AiError)
  expect(failure).toMatchObject({ category: 'tool_validation', retryable: false, message: expect.stringContaining('Choose a known reference system') })
  expect(JSON.stringify(serializeAiError(failure))).not.toContain('private-unknown-system')
  expect(getSystem).toHaveBeenCalledTimes(1)
  expect(findTargets).not.toHaveBeenCalled()
  await expect(execute({ systemName: 'Sol' })).resolves.toMatchObject({ structuredContent: { originSystem: 'Sol' } })
  expect(findTargets).toHaveBeenCalledTimes(1)
})

test('incompatible population filters return domain corrections before searching systems', async () => {
  const findSystems = vi.fn(async () => [])
  const getSystem = vi.fn(async () => ({ cache: 'fresh' as const, system: fixtureSystem() }))
  const service = new DefaultStationMarketQuery(
    { findCommodityMarkets: async () => [], findSystemExports: async () => [], findSystemImports: async () => [], getCommodityReports: async () => [], findNearestStations: async () => [] },
    { getOutfitting: async () => [], getShipyard: async () => [] },
    { shipNames: async () => [], findShipyards: async () => [] },
    { moduleNames: async () => [], findOutfitting: async () => [] },
    { findStations: async () => [] },
    { findSystems },
    { findFactionPresences: async () => [] },
    { getSystem },
    currentRuntime(),
    emptyCache()
  )
  const execute = toolExecutor(new SystemsSearchTool(service))
  for (const [arguments_, hint] of [
    [{ minPopulation: 100, maxPopulation: 10 }, 'Lower minPopulation'],
    [{ population: 'inhabited', maxPopulation: 0 }, 'Increase maxPopulation'],
    [{ population: 'uninhabited', minPopulation: 1 }, 'Set minPopulation to zero']
  ] as const) {
    await expect(execute(arguments_)).rejects.toMatchObject({ category: 'tool_validation', retryable: false, message: expect.stringContaining(hint) })
  }
  expect(findSystems).not.toHaveBeenCalled()
  expect(getSystem).not.toHaveBeenCalled()
  await expect(execute({ population: 'uninhabited', minPopulation: 0, maxPopulation: 0 }))
    .resolves.toMatchObject({ structuredContent: { originSystem: 'Sol', systems: [] } })
  expect(findSystems).toHaveBeenCalledTimes(1)
  expect(findSystems).toHaveBeenCalledWith(expect.objectContaining({ population: 'uninhabited', minPopulation: 0, maxPopulation: 0 }))
})

function toolExecutor (tool: LocalTool) {
  const registry = new ToolRegistry([withToolErrorBoundary(tool)])
  return (arguments_: JsonObject) => registry.execute({ id: 'domain-correction', name: tool.definition.name, arguments: arguments_ }, {
    callId: 'domain-correction', deadline: '2026-10-04T12:00:00Z', runId: 'domain-correction', signal: new AbortController().signal
  })
}

function explorationFixture (knownCurrent = true) {
  const findTargets = vi.fn(async () => [])
  const getSystem = vi.fn(async (name: string) => ({ cache: 'fresh' as const, system: { ...fixtureSystem(), name, position: name === 'Sol' ? [0, 0, 0] as [number, number, number] : null } }))
  const service = new DefaultExplorationTargetQuery({ findTargets }, { getSystem }, knownCurrent ? currentRuntime() : new InMemoryRuntimeStateStore(), emptyCache())
  return { execute: toolExecutor(new ExplorationSearchTargetsTool(service)), findTargets, getSystem }
}

function currentRuntime () {
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({ ...state, system: { ...state.system, name: 'Sol', position: [0, 0, 0] } })
  return runtime
}

function emptyCache (): ProviderResponseCache {
  return { getProviderResponse: () => null, putProviderResponse: vi.fn() }
}

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 5, name: 'Sol', address: 10477373803, position: [0, 0, 0], permitRequired: null, permitName: null,
    information: { allegiance: null, government: null, security: null, state: null, primaryEconomy: null, secondaryEconomy: null, population: null, controllingFaction: null },
    primaryStar: null, bodies: [], stations: [], scanProgress: { knownBodies: 0, reportedBodies: null, percent: null }, localSystem: null,
    provenance: { edsm: null, journal: null }, raw: { system: {}, bodies: {}, stations: {} }
  }
}
