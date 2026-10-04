import { expect, test, vi } from 'vitest'
import { AiError, ToolRegistry, ToolUsageError, serializeAiError, type JsonObject, type LocalTool } from '@jdu/llm-client'
import { createPhoenixMcpTools, type PhoenixMcpToolDependencies } from '../apps/server/src/application/phoenix-mcp-tools.js'
import { withToolErrorBoundary } from '../apps/server/src/application/mcp-tools/tool-error-boundary.js'
import { ToolArgumentError } from '../apps/server/src/application/mcp-tools/tool-support.js'
import { ControlsExecuteTool } from '../apps/server/src/application/mcp-tools/controls-execute-tool.js'
import { assertControlExecution } from '../apps/server/src/application/mcp-tools/control-execution-errors.js'
import type { Commands } from '../apps/server/src/domain/commands.js'
import { CopilotRealtimeService, type CopilotRealtimeServiceOptions } from '../apps/server/src/application/copilot-realtime-service.js'
import { WebSearchTool } from '../apps/server/src/application/mcp-tools/web-search-tool.js'
import { ProviderQueryError, type ProviderQueryErrorKind } from '../apps/server/src/domain/provider-query-error.js'

const context = () => ({ callId: 'audit', deadline: '2026-10-04T12:00:00Z', runId: 'audit', signal: new AbortController().signal })
const requiredArguments: Record<string, JsonObject> = {
  'controls.find_actions': { query: 'lights' },
  'controls.execute_command': { target: { type: 'game-action', actionId: 'elite.ShipSpotLightToggle' } },
  'controls.set_control_state': { actionId: 'elite.ShipSpotLightToggle', enabled: true },
  'display.open_page': { page: 'ship' },
  'display.show_body_details': { bodyName: 'Sol A 1' },
  'navigation.check_jump_reachability': { systemName: 'Sol' },
  'stations.find_stations_selling_module': { query: '6A Power Plant' },
  'markets.find_commodity_markets': { commodity: 'Gold', intent: 'buy' },
  'ships.compare_ship_definitions': { identifiers: ['Adder', 'Cobra Mk III'] },
  'stations.find_shipyards_selling_ship': { hullName: 'Adder' },
  'ships.get_ship_definition': { identifier: 'Adder' },
  'stations.find_nearest_service': { service: 'repair' },
  'stations.find_stations_by_name': { name: 'Sweet Terminal' },
  'stations.list_outfitting_stock': { query: 'Power Plant' },
  'web.search_web': { query: 'Elite' }
}

function failingTools (): LocalTool[] {
  const port = new Proxy({}, { get: () => () => { throw new Error('secret-backend-key and private diagnostics') } })
  return createPhoenixMcpTools(new Proxy({}, { get: () => port }) as PhoenixMcpToolDependencies)
}

test('every registered Copilot tool rejects invalid schema arguments with correction feedback', async () => {
  const tools = failingTools()
  const registry = new ToolRegistry(tools)
  for (const tool of tools) {
    await expect(registry.execute({ id: 'audit', name: tool.definition.name, arguments: {
      ...requiredArguments[tool.definition.name], invalidField: 'secret-argument-value'
    } }, context())).rejects.toMatchObject({
      category: 'tool_validation', retryable: false,
      message: expect.stringContaining('Remove unknown argument')
    })
  }
})

test('every registered handler sanitizes unexpected failures without misclassifying them as usage errors', async () => {
  const tools = failingTools()
  const registry = new ToolRegistry(tools)
  for (const tool of tools) {
    let failure: unknown
    try {
      await registry.execute({ id: 'audit', name: tool.definition.name, arguments: requiredArguments[tool.definition.name] ?? {} }, context())
    } catch (cause) { failure = cause }
    expect(failure, tool.definition.name).toBeInstanceOf(AiError)
    expect(failure, tool.definition.name).toMatchObject({ category: 'tool_execution', code: 'tool_internal_error', retryable: false })
    const serialized = JSON.stringify(serializeAiError(failure as AiError))
    expect(serialized).not.toContain('secret-backend-key')
    expect(serialized).not.toContain('private diagnostics')
    expect(serialized).not.toContain('stack')
    expect(serialized).toContain('do not guess different arguments or repeat the operation')
  }
})

test('typed argument errors become usage feedback, while public provider/configuration errors retain their categories', async () => {
  const tool = { definition: { name: 'test.audit', description: 'Audit.', inputSchema: { type: 'object' } }, execute: vi.fn() }
  const wrapped = withToolErrorBoundary(tool)
  tool.execute.mockImplementationOnce(() => { throw new ToolArgumentError('field must be non-empty.', 'Supply field as non-whitespace text.') })
  await expect(wrapped.execute({}, context())).rejects.toMatchObject({ category: 'tool_validation', retryable: false,
    message: 'Tool test.audit: field must be non-empty. Correction: Supply field as non-whitespace text.' })
  for (const category of ['provider_unavailable', 'timeout', 'authentication', 'authorization', 'cancelled', 'malformed_response'] as const) {
    const error = new AiError(category, 'Intentionally public feedback.', { code: 'audit', retryable: category === 'timeout', cause: new Error('private') })
    tool.execute.mockImplementationOnce(() => { throw error })
    await expect(wrapped.execute({}, context())).rejects.toBe(error)
  }
})

test('aborted handler failures are cancellation, with no reason or diagnostic exposure', async () => {
  const controller = new AbortController()
  controller.abort(new Error('private-abort-reason'))
  const tool = withToolErrorBoundary({ definition: { name: 'test.cancel', description: 'Audit.', inputSchema: { type: 'object' } },
    execute: () => { throw controller.signal.reason } })
  await expect(tool.execute({}, { ...context(), signal: controller.signal })).rejects.toMatchObject({
    category: 'cancelled', code: 'tool_cancelled', retryable: false, message: expect.not.stringContaining('private-abort-reason')
  })
})

test.each<ProviderQueryErrorKind>(['transport', 'timeout', 'rate_limit', 'provider_unavailable', 'authentication', 'authorization', 'malformed_response', 'not_found', 'request_rejected'])('typed provider %s remains distinct and safe at the tool boundary', async kind => {
  const tool = withToolErrorBoundary({
    definition: { name: 'test.provider', description: 'Audit.', inputSchema: { type: 'object' } },
    execute: () => { throw new ProviderQueryError('Spansh', kind, { cause: new Error('secret-url/argument and private diagnostics') }) }
  })
  let failure: unknown
  try { await tool.execute({}, context()) } catch (cause) { failure = cause }
  expect(failure).toBeInstanceOf(AiError)
  const publicError = serializeAiError(failure as AiError)
  expect(publicError.category).toBe(kind === 'not_found' ? 'tool_validation' : kind === 'request_rejected' ? 'invalid_request' : kind)
  expect(publicError.retryable).toBe(['transport', 'timeout', 'rate_limit', 'provider_unavailable'].includes(kind))
  expect(publicError.message).toContain('Spansh')
  expect(JSON.stringify(publicError)).not.toMatch(/secret-url|private diagnostics|argument and|stack/)
})

test('Realtime executes the same boundary and allows corrected usage without unchanged retries', async () => {
  const search = vi.fn(async () => ({ answer: 'Verified.', sources: [] }))
  const tools = new ToolRegistry([withToolErrorBoundary(new WebSearchTool({ search }))])
  // Only the shared executeTool bridge is exercised; session creation is covered separately.
  const realtime = new CopilotRealtimeService({ tools } as CopilotRealtimeServiceOptions)
  await expect(realtime.executeTool({ name: 'phoenix_web_search_web', arguments: { query: '   ' } }))
    .rejects.toMatchObject({ category: 'tool_validation', retryable: false, message: expect.stringContaining('non-whitespace text') })
  expect(search).not.toHaveBeenCalled()
  await expect(realtime.executeTool({ name: 'phoenix_web_search_web', arguments: { query: 'corrected' } }))
    .resolves.toMatchObject({ structuredContent: { answer: 'Verified.' } })
  expect(search).toHaveBeenCalledTimes(1)
})

test('invalid control combinations stop before input dispatch and accept a corrected follow-up', async () => {
  const execute = vi.fn(async () => ({ status: 'accepted', message: 'Dispatched.' }))
  const tool = withToolErrorBoundary(new ControlsExecuteTool({ execute } as unknown as Commands))
  const registry = new ToolRegistry([tool])
  const target = { type: 'macro', macroId: 'test-macro' }
  await expect(registry.execute({ id: 'bad', name: tool.definition.name, arguments: { target, operation: 'press' } }, context()))
    .rejects.toBeInstanceOf(ToolUsageError)
  expect(execute).not.toHaveBeenCalled()
  await expect(registry.execute({ id: 'fixed', name: tool.definition.name, arguments: { target, operation: 'tap' } }, context()))
    .resolves.toMatchObject({ structuredContent: { status: 'accepted' } })
  expect(execute).toHaveBeenCalledTimes(1)
  await expect(registry.execute({ id: 'lease', name: tool.definition.name, arguments: {
    target: { type: 'game-action', actionId: 'elite.PrimaryFire' }, operation: 'press'
  } }, context())).rejects.toMatchObject({ message: expect.stringContaining('same non-empty leaseId') })
  expect(execute).toHaveBeenCalledTimes(1)
})

test('control failures distinguish permission, timeout and cancellation and never advise repeating side effects', () => {
  const outcomes = [
    ['rejected', 'This Copilot capability is disabled in Settings.', 'authorization'],
    ['rejected', 'private-control-error', 'tool_execution'],
    ['failed', 'private-control-error', 'tool_execution'],
    ['timed_out', 'private-control-error', 'timeout'],
    ['cancelled', 'private-control-error', 'cancelled']
  ] as const
  for (const [status, message, category] of outcomes) {
    let failure: unknown
    try { assertControlExecution('controls.execute_command', { status, message }) } catch (cause) { failure = cause }
    expect(failure).toMatchObject({ category, retryable: false })
    expect((failure as Error).message).not.toContain('private-control-error')
  }
  for (const status of ['accepted', 'already_satisfied', 'confirmed', 'unconfirmed'] as const) {
    expect(() => assertControlExecution('controls.execute_command', { status, message: 'Public.' })).not.toThrow()
  }
  expect(() => assertControlExecution('controls.execute_command', { status: 'rejected', message: 'Unknown command target.' }))
    .toThrow(ToolUsageError)
  expect(() => assertControlExecution('controls.execute_command', { status: 'private-new-status' as never, message: 'private-control-error' }))
    .toThrow('do not repeat the operation')
})
