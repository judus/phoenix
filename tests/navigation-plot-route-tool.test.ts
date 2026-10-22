import { expect, test, vi } from 'vitest'
import type { JsonObject } from '@jdu/llm-client'
import type { PlotEliteDestinationResult } from '@phoenix/contracts'
import { NavigationPlotRouteTool } from '../apps/server/src/application/mcp-tools/navigation-plot-route-tool.js'
import { withToolErrorBoundary } from '../apps/server/src/application/mcp-tools/tool-error-boundary.js'
import { CopilotToolRegistry, COPILOT_TOOL_TIMEOUT_MS } from '../apps/server/src/application/copilot-tool-registry.js'
import { CopilotRealtimeService, type CopilotRealtimeServiceOptions } from '../apps/server/src/application/copilot-realtime-service.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

const capabilityId = 'tool:navigation.plot_route'
const context = () => ({ callId: 'route', runId: 'route-test', deadline: new Date(Date.now() + COPILOT_TOOL_TIMEOUT_MS).toISOString(), signal: new AbortController().signal })
const outcome = (status: PlotEliteDestinationResult['status']): PlotEliteDestinationResult => ({
  status, requestedSystem: 'Sol', confirmedSystem: status === 'confirmed' ? 'Sol' : null,
  phase: status === 'rejected' ? 'preflight' : 'confirm_route', message: `Route ${status}.`,
  bindingWarnings: status === 'confirmed' ? [] : ['Check Galaxy Map keyboard bindings.']
})

test.each(['confirmed', 'rejected', 'failed', 'timed_out'] as const)('route tool preserves %s and diagnostics without retrying', async status => {
  const result = outcome(status)
  const plot = vi.fn(async () => result)
  const tool = new NavigationPlotRouteTool({ plot })
  const execution = context()
  const response = await tool.execute({ systemName: '  Sol  ' }, execution)
  expect(plot).toHaveBeenCalledExactlyOnceWith('Sol', execution.signal)
  expect(response.structuredContent).toEqual(result)
  expect(response.content).toMatchObject([{ text: expect.stringContaining(`Route plotting ${status}`) }])
  if (status !== 'confirmed') expect(response.content).toMatchObject([{ text: expect.stringContaining('Do not claim the route is plotted') }])
})

test.each<JsonObject>([{}, { systemName: '   ' }, { systemName: 123 }, { systemName: 'x'.repeat(129) }])('rejects invalid input before game input', async arguments_ => {
  const plot = vi.fn(async () => outcome('confirmed'))
  await expect(withToolErrorBoundary(new NavigationPlotRouteTool({ plot })).execute(arguments_, context()))
    .rejects.toMatchObject({ category: 'tool_validation', retryable: false })
  expect(plot).not.toHaveBeenCalled()
})

test('cancellation reaches the existing routine and is not reported as an ordinary route result', async () => {
  const controller = new AbortController()
  const plot = vi.fn(async (_system: string, signal?: AbortSignal) => {
    expect(signal).toBe(controller.signal)
    controller.abort()
    return outcome('failed')
  })
  const tool = withToolErrorBoundary(new NavigationPlotRouteTool({ plot }))
  await expect(tool.execute({ systemName: 'Sol' }, { ...context(), signal: controller.signal }))
    .rejects.toMatchObject({ category: 'cancelled', retryable: false })
  expect(plot).toHaveBeenCalledTimes(1)
  plot.mockClear()
  await expect(tool.execute({ systemName: 'Sol' }, { ...context(), signal: controller.signal }))
    .rejects.toMatchObject({ category: 'cancelled', retryable: false })
  expect(plot).not.toHaveBeenCalled()
})

test('Galaxy control permission is opt-in, and installation/profile policies gate dispatch', async () => {
  const plot = vi.fn(async () => outcome('rejected'))
  const tool = new NavigationPlotRouteTool({ plot })
  const settings = new InMemorySystemSettingsRepository()
  const capabilities = new DefaultCopilotCapabilityService(() => [tool.definition], {
    find: () => undefined, getCatalog: () => ({ commands: [] })
  }, settings)
  const registry = new CopilotToolRegistry([tool], capabilities)
  expect(tool.definition.annotations).toMatchObject({ readOnly: false, idempotent: false })
  expect(capabilities.catalogue().groups).toMatchObject([{ id: 'tools.galaxy', capabilities: [{ id: capabilityId, access: 'control', enabled: false }] }])
  const call = { name: tool.definition.name, arguments: { systemName: 'Sol' }, id: 'plot' }
  await expect(registry.execute(call, context())).rejects.toThrow('disabled in Settings')
  const profileId = settings.loadOrCreate().copilot.activeProfileId
  capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: [capabilityId] })
  capabilities.saveProfilePolicy(profileId, { version: 2, enabledCapabilityIds: [] })
  await expect(registry.execute(call, context())).rejects.toThrow('disabled in Settings')
  expect(plot).not.toHaveBeenCalled()
  capabilities.saveProfilePolicy(profileId, { version: 2, enabledCapabilityIds: [capabilityId] })
  expect(registry.definitions).toEqual([tool.definition])
  await expect(registry.execute({ ...call, arguments: { systemName: 'Sol', extra: true } }, context())).rejects.toThrow()
  expect(plot).not.toHaveBeenCalled()
  await expect(registry.execute(call, context())).resolves.toMatchObject({ structuredContent: { status: 'rejected' } })
  capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: [] })
  await expect(registry.execute(call, context())).rejects.toThrow('disabled in Settings')
  expect(plot).toHaveBeenCalledTimes(1)
})

test('voice dispatch uses the same tool and allows a route confirmation beyond 30 seconds', async () => {
  vi.useFakeTimers()
  try {
    const plot = vi.fn(async (_system: string, signal?: AbortSignal) => {
      await new Promise(resolve => setTimeout(resolve, 40_000))
      signal?.throwIfAborted()
      return outcome('confirmed')
    })
    const tool = new NavigationPlotRouteTool({ plot })
    const { ToolRegistry } = await import('@jdu/llm-client')
    const service = new CopilotRealtimeService({ tools: new ToolRegistry([tool]) } as CopilotRealtimeServiceOptions)
    const pending = service.executeTool({ name: 'phoenix_navigation_plot_route', arguments: { systemName: 'Sol' } })
    await vi.advanceTimersByTimeAsync(40_000)
    await expect(pending).resolves.toMatchObject({ structuredContent: { status: 'confirmed' } })
    expect(plot).toHaveBeenCalledTimes(1)
  } finally { vi.useRealTimers() }
})
