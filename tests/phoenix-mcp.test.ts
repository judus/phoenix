import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import {
  AiError,
  createAiClient,
  type ConfiguredProvider,
  type ConversationMessage,
  type ModelResponse
} from '@jdu/llm-client'
import { ScriptedProvider, textModelCapabilities } from '@jdu/llm-client/testing'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { InMemoryMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'
import { mockDenseCartography } from '../scripts/diagnostics/mock-dense-cartography.mjs'
import { RecordingKeyboardOutput } from 'control-deck/adapter-keyboard'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { JsonConversationStore } from '../apps/server/src/infrastructure/json-conversation-store.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { analysisArticle, savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

test('GalNet tools reconcile persisted reports over MCP without inference or source refresh and expose both Comms permissions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-tools-'))
  const databasePath = join(directory, 'state.sqlite')
  const db = new SqliteDatabase(databasePath)
  let report
  try {
    db.initialize()
    db.galnetArchive.observe([analysisArticle], '2026-10-07T12:00:00Z')
    report = savedGalnetAnalysis({ articleRevisionId: db.galnetArchive.getArticle(analysisArticle.id)!.revisionId })
    db.galnetAnalyses.put(report)
    const followup = { ...analysisArticle, id: 'beacon-completed', title: 'Beacon research complete',
      body: 'Beacon research completed in Colonia.', publishedAt: '2026-10-02T12:00:00Z',
      sourceUrl: 'https://example.com/galnet/beacon-completed' }
    db.galnetArchive.observe([followup], '2026-10-08T12:00:00Z')
    db.galnetAnalyses.put({ ...savedGalnetAnalysis(), schemaVersion: 3, extractorVersion: 'galnet-analysis-v3',
      articleId: followup.id, articleRevisionId: db.galnetArchive.getArticle(followup.id)!.revisionId,
      cacheKey: 'completed-cache', publishedAt: followup.publishedAt, analysedAt: '2026-10-08T12:00:00Z', sourceUrl: followup.sourceUrl,
      content: { summary: followup.body, facts: [], interpretations: [], entities: [], activities: [] },
      context: [{ articleId: report.articleId, articleRevisionId: report.articleRevisionId, analysisCacheKey: report.cacheKey,
        title: analysisArticle.title, sourceUrl: report.sourceUrl, publishedAt: report.publishedAt, communityGoals: report.communityGoals }],
      continuity: { summary: followup.body, relatedArticleIds: [report.articleId],
        developments: [{ text: followup.body, evidence: { articleId: followup.id, quote: followup.body } }],
        updates: [{ leadId: `galnet-lead:${report.cacheKey}:1`, disposition: 'resolved', explanation: 'Research completed.',
          evidence: { articleId: followup.id, quote: followup.body }, replacementActivityIndex: null, communityGoalId: null }] } })
  } finally { db.close() }
  const analyse = vi.fn(async () => { throw new Error('Unexpected inference') })
  const getLatest = vi.fn(async () => { throw new Error('Unexpected news refresh') })
  const getCurrent = vi.fn(async () => { throw new Error('Unexpected CG refresh') })
  const application = new PhoenixApplication({ databasePath, eliteDirectory: null, host: '127.0.0.1', port: 0,
    copilot: null, copilotRealtime: null, openAiEnvironmentKey: null,
    galnetAnalyser: { configured: () => false, model: 'no-model', analyse },
    galnetSource: { getLatest }, communityGoalsSource: { getCurrent } })
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    const provider = configuredProvider([
      response('galnet-list', [{ arguments: { limit: 2 }, callId: 'list', name: 'phoenix__comms_list_galnet_analyses', type: 'tool_call' }], 'tool_calls'),
      response('galnet-detail', [{ arguments: { articleId: analysisArticle.id }, callId: 'detail', name: 'phoenix__comms_get_galnet_analysis', type: 'tool_call' }], 'tool_calls'),
      response('done', [{ source: 'generated', text: 'Saved report received.', type: 'text' }], 'stop')
    ])
    const client = createAiClient({ mcp: [{ name: 'phoenix', url: `${origin}/mcp` }], provider })
    const api = new PhoenixApiClient(origin)
    const permissions = await api.getCopilotSettings()
    const comms = permissions.capabilities.groups.find(group => group.id === 'tools.comms')!
    for (const id of ['tool:comms.list_galnet_analyses', 'tool:comms.get_galnet_analysis']) {
      expect(comms.capabilities).toContainEqual(expect.objectContaining({ id, access: 'read', available: true, enabled: true }))
    }
    await client.user('What is the story behind this campaign?').run()
    expect(provider.requests[1]?.messages.at(-1)?.content).toMatchObject([{ type: 'tool_result', status: 'success', structuredContent: {
      limit: 2, reports: [{ articleId: 'beacon-completed', currentInvestigationLeadCount: 0 },
        { articleId: analysisArticle.id, articleChanged: false, summary: report.content.summary,
          originalInvestigationLeadCount: 1, currentInvestigationLeadCount: 0 }]
    } }])
    expect(provider.requests[2]?.messages.at(-1)?.content).toMatchObject([{ type: 'tool_result', status: 'success', structuredContent: {
      articleChanged: false, report, currentInvestigationLeads: [],
      leadAssessments: [{ disposition: 'resolved', assessments: [{ articleId: 'beacon-completed',
        evidenceSourceUrl: 'https://example.com/galnet/beacon-completed', update: { evidence: { quote: 'Beacon research completed in Colonia.' } } }] }]
    } }])
    expect((await api.getGalnetAnalysis(analysisArticle.id)).analysis).toEqual(report)
    expect(analyse).not.toHaveBeenCalled()
    expect(getLatest).not.toHaveBeenCalled()
    expect(getCurrent).not.toHaveBeenCalled()
  } finally { await application.stop(); rmSync(directory, { recursive: true, force: true }) }
})

test('Atlas navigation over MCP resolves cartography and exposes a Display permission', async () => {
  const fetchSystem = vi.fn(async (name: string) => mockDenseCartography(name))
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, cartographySource: { fetchSystem } })
  const address = await application.start()
  const origin = `http://${address.host}:${address.port}`
  const api = new PhoenixApiClient(origin)
  const provider = configuredProvider([
    response('atlas', [{ arguments: { systemName: 'Colonia' }, callId: 'atlas', name: 'phoenix__display_show_galactic_atlas', type: 'tool_call' }], 'tool_calls'),
    response('done', [{ source: 'generated', text: 'Atlas opened.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({ mcp: [{ name: 'phoenix', url: `${origin}/mcp` }], provider })
  try {
    const permissions = await api.getCopilotSettings()
    expect(permissions.capabilities.groups.find(group => group.id === 'tools.display')?.capabilities)
      .toContainEqual(expect.objectContaining({ id: 'tool:display.show_galactic_atlas', label: 'Show Galactic Atlas', access: 'display', available: true, enabled: true }))
    expect(fetchSystem).not.toHaveBeenCalled()
    await client.user('Show Colonia on the PHOENIX Atlas.').run()
    expect(fetchSystem).toHaveBeenCalledWith('Colonia')
    expect(provider.requests[1]?.messages.at(-1)?.content).toMatchObject([{
      type: 'tool_result', status: 'success', structuredContent: { displayed: true,
        location: { systemName: 'Colonia', position: mockDenseCartography('Colonia').position } }
    }])
  } finally { await application.stop() }
})

test('Community Goals over MCP reuse the Activities snapshot and expose their read-only permission', async () => {
  const getCurrent = vi.fn(async () => [{
    id: 'synthetic-cg', title: 'Research supplies', systemName: 'Sol', stationName: 'Galileo',
    activityType: 'trade', objective: 'Deliver supplies', targetCommodities: 'Basic Medicines',
    contributed: 125, target: 1000, expiry: '2026-10-08 10:00:00', briefing: 'Sign up at Galileo.\nDeliver supplies.'
  }])
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, communityGoalsSource: { getCurrent } })
  const address = await application.start()
  const origin = `http://${address.host}:${address.port}`
  const api = new PhoenixApiClient(origin)
  const provider = configuredProvider([
    response('community-goals', [{ arguments: {}, callId: 'goals', name: 'phoenix__activities_list_community_goals', type: 'tool_call' }], 'tool_calls'),
    response('done', [{ source: 'generated', text: 'Goals received.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({ mcp: [{ name: 'phoenix', url: `${origin}/mcp` }], provider })
  try {
    expect(getCurrent).not.toHaveBeenCalled()
    const permissions = await api.getCopilotSettings()
    expect(permissions.capabilities.groups.find(group => group.id === 'tools.activities')?.capabilities)
      .toContainEqual(expect.objectContaining({ id: 'tool:activities.list_community_goals', label: 'List Community Goals', access: 'read', available: true }))
    const before = await api.getCommunityGoals()
    await client.user('Which Community Goals can I participate in?').run()
    expect(provider.requests[1]?.messages.at(-1)?.content).toMatchObject([{
      type: 'tool_result', status: 'success', structuredContent: {
        ...before, cache: 'fresh', sourceUrl: 'https://www.elitedangerous.com/community/goals/'
      }
    }])
    expect(getCurrent).toHaveBeenCalledTimes(1)
  } finally { await application.stop() }
})

test('project report reads persisted plans over MCP and appears in installation permission settings', async () => {
  const settings = new InMemorySystemSettingsRepository()
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, systemSettingsRepository: settings })
  const address = await application.start()
  const origin = `http://${address.host}:${address.port}`
  const api = new PhoenixApiClient(origin)
  const provider = configuredProvider([
    response('project-report', [{ arguments: {}, callId: 'report', name: 'phoenix__engineering_get_project_report', type: 'tool_call' }], 'tool_calls'),
    response('done', [{ source: 'generated', text: 'Report received.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({ mcp: [{ name: 'phoenix', url: `${origin}/mcp` }], provider })
  try {
    const project = await api.createEngineeringProject({ name: 'Fixture refit', note: null, priority: 'high' })
    await api.addEngineeringProjectStep(project.id, {
      blueprintSymbol: 'TestModule_Reinforced', targetGrade: 1, plannedRolls: 3, note: null
    })
    const before = await api.getEngineeringProjects()
    const permissions = await api.getCopilotSettings()
    expect(permissions.capabilities.groups.find(group => group.id === 'tools.engineering')?.capabilities)
      .toContainEqual(expect.objectContaining({ id: 'tool:engineering.get_project_report', access: 'read', available: true }))
    await client.user('What do I need for my projects?').run()
    expect(provider.requests[1]?.messages.at(-1)?.content).toMatchObject([{
      type: 'tool_result', status: 'success', structuredContent: {
        projects: [{ id: project.id, name: 'Fixture refit', steps: [{ plannedRolls: 3 }] }],
        materials: [{ materialId: 'TestWidgets', required: 3, owned: null, missing: null }]
      }
    }])
    expect(await api.getEngineeringProjects()).toEqual(before)
  } finally { await application.stop() }
})

test('handler corrections support a corrected MCP call and survive persisted text history safely', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-tool-history-'))
  const conversations = new JsonConversationStore(directory)
  const search = vi.fn(async (query: string) => {
    if (query === 'corrected') return { answer: 'Verified answer.', sources: [] }
    throw new Error('secret-provider-token and private backend stack')
  })
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, webSearchSource: { search } })
  const address = await application.start()
  const provider = configuredProvider([
    response('bad-handler-input', [{ arguments: { query: '   ' }, callId: 'blank', name: 'phoenix__web_search_web', type: 'tool_call' }], 'tool_calls'),
    response('corrected-input', [{ arguments: { query: 'corrected' }, callId: 'fixed', name: 'phoenix__web_search_web', type: 'tool_call' }], 'tool_calls'),
    response('private-failure', [{ arguments: { query: 'fail' }, callId: 'internal', name: 'phoenix__web_search_web', type: 'tool_call' }], 'tool_calls'),
    response('done', [{ source: 'generated', text: 'Done.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({ history: { repository: conversations },
    mcp: [{ name: 'phoenix', url: `http://${address.host}:${address.port}/mcp` }], provider })
  try {
    const result = await client.chat('mcp-test').user('Test corrective feedback.').run()
    expect(JSON.stringify(provider.requests[1]?.messages)).toContain('Provide query as a string containing non-whitespace text')
    expect(JSON.stringify(provider.requests[2]?.messages)).toContain('Verified answer.')
    expect(search).toHaveBeenCalledTimes(2)
    const persisted = JSON.stringify(await conversations.snapshot(result.chatId))
    expect(persisted).toContain('Correction:')
    expect(persisted).toContain('do not guess different arguments or repeat the operation')
    expect(persisted).not.toContain('secret-provider-token')
    expect(persisted).not.toContain('private backend stack')
  } finally {
    await application.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Copilot receives correction hints and public execution errors through MCP', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0,
    webSearchSource: { search: async () => { throw new AiError('timeout', 'Web search timed out. Retry once with the same query.', { code: 'web_search_timeout', retryable: true, cause: new Error('secret-provider-key') }) } }
  })
  const address = await application.start()
  const provider = configuredProvider([
    response('bad-input', [{ arguments: { service: 'refuel', maxDistance: 500, limit: 5 }, callId: 'invalid', name: 'phoenix__stations_find_nearest_service', type: 'tool_call' }], 'tool_calls'),
    response('web-failure', [{ arguments: { query: 'test' }, callId: 'web', name: 'phoenix__web_search_web', type: 'tool_call' }], 'tool_calls'),
    response('done', [{ source: 'generated', text: 'Reported.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({ mcp: [{ name: 'phoenix', url: `http://${address.host}:${address.port}/mcp` }], provider })
  try {
    await client.user('Test failures').run()
    const validation = JSON.stringify(provider.requests[1]?.messages)
    expect(validation).toContain('Remove unknown argument')
    expect(validation).toContain('maxDistance')
    expect(JSON.stringify(provider.requests[2]?.messages)).toContain('Web search timed out. Retry once with the same query.')
    expect(JSON.stringify(provider.requests)).not.toContain('secret-provider-key')
  } finally { await application.stop() }
})

test('the portable AI client discovers and calls PHOENIX tools over MCP', async () => {
  const systemSettingsRepository = new InMemorySystemSettingsRepository()
  enableCapabilities(systemSettingsRepository, 'command.elite.ShipSpotLightToggle')
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0,
    systemSettingsRepository
  })
  const address = await application.start()
  const provider = configuredProvider([
    response('tool-step', [
      {
        arguments: {},
        callId: 'current-state-1',
        name: 'phoenix__commander_get_current_situation',
        type: 'tool_call'
      },
      {
        arguments: {},
        callId: 'projects-1',
        name: 'phoenix__engineering_get_project_report',
        type: 'tool_call'
      },
      {
        arguments: { query: 'turn the ship lights on' },
        callId: 'find-lights-1',
        name: 'phoenix__controls_find_actions',
        type: 'tool_call'
      },
      {
        arguments: { detail: 'summary', identifier: 'lakonminer' },
        callId: 'type-11-definition-1',
        name: 'phoenix__ships_get_ship_definition',
        type: 'tool_call'
      }
    ], 'tool_calls'),
    response('answer-step', [{ source: 'generated', text: 'Telemetry received.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({
    mcp: [{ name: 'phoenix', url: `http://${address.host}:${address.port}/mcp` }],
    provider
  })

  try {
    const result = await client.user('Where are we?').run()

    expect(result.text).toBe('Telemetry received.')
    expect(provider.requests).toHaveLength(2)
    expect(provider.requests[0]?.tools?.map(tool => tool.name)).toEqual([
      'phoenix__commander_get_current_situation',
      'phoenix__equipment_get_equipment_report',
      'phoenix__engineering_list_engineers',
      'phoenix__engineering_get_project_report',
      'phoenix__engineering_list_material_inventory',
      'phoenix__comms_list_messages',
      'phoenix__comms_list_galnet_analyses',
      'phoenix__comms_get_galnet_analysis',
      'phoenix__controls_find_actions',
      'phoenix__controls_execute_command',
      'phoenix__controls_set_control_state',
      'phoenix__display_open_page',
      'phoenix__display_show_galactic_atlas',
      'phoenix__display_show_body_details',
      'phoenix__display_show_system_schematic',
      'phoenix__exploration_get_current_body_signals',
      'phoenix__exploration_find_exploration_targets',
      'phoenix__factions_find_faction_presence',
      'phoenix__fleet_list_owned_ships',
      'phoenix__fleet_list_stored_modules',
      'phoenix__navigation_check_jump_reachability',
      'phoenix__navigation_get_plotted_route',
      'phoenix__missions_list_missions',
      'phoenix__notes_search_notes',
      'phoenix__notes_get_note',
      'phoenix__notes_create_note',
      'phoenix__notes_update_note',
      'phoenix__activities_list_community_goals',
      'phoenix__stations_find_stations_selling_module',
      'phoenix__markets_find_commodity_markets',
      'phoenix__markets_find_trade_opportunities',
      'phoenix__ship_get_cargo_manifest',
      'phoenix__ship_get_current_ship_status',
      'phoenix__ship_list_installed_modules',
      'phoenix__ships_compare_ship_definitions',
      'phoenix__stations_find_shipyards_selling_ship',
      'phoenix__ships_get_ship_definition',
      'phoenix__stations_find_nearest_service',
      'phoenix__stations_get_station_details',
      'phoenix__stations_list_shipyard_stock',
      'phoenix__stations_find_stations_by_name',
      'phoenix__stations_list_outfitting_stock',
      'phoenix__systems_get_system_details',
      'phoenix__systems_find_systems',
      'phoenix__web_search_web'
    ])
    expect(provider.requests[0]?.tools?.find(tool => tool.name === 'phoenix__display_open_page')).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        properties: { page: { minLength: 1, type: 'string' } },
        required: ['page'],
        type: 'object'
      }
    })
    expect(JSON.stringify(provider.requests[0]?.tools?.find(tool => tool.name === 'phoenix__display_open_page')))
      .not.toContain('galaxy.route')
    expect(provider.requests[1]?.messages.at(-1)).toMatchObject({
      role: 'tool',
      content: [
        {
          callId: 'current-state-1',
          status: 'success',
          structuredContent: {
            location: { state: 'unknown' },
            revision: 0
          },
          type: 'tool_result'
        },
        {
          callId: 'projects-1',
          status: 'success',
          structuredContent: {
            inventoryAvailable: false,
            observedAt: null,
            projects: [],
            materials: [],
            personalEquipment: 'unsaved_preview_only',
            schemaVersion: 1
          },
          type: 'tool_result'
        },
        {
          callId: 'find-lights-1',
          status: 'success',
          structuredContent: {
            matches: [{
              commandId: 'command.elite.ShipSpotLightToggle',
              label: 'Ship Lights',
              target: { actionId: 'elite.ShipSpotLightToggle', type: 'game-action' }
            }]
          },
          type: 'tool_result'
        },
        {
          callId: 'type-11-definition-1',
          status: 'success',
          structuredContent: {
            displayName: 'Type-11 Prospector',
            id: 'type_11_prospector'
          },
          type: 'tool_result'
        }
      ]
    })
  } finally {
    await application.stop()
  }
})

test('the Copilot discovers and executes commander-created macros through the consolidated controls tools', async () => {
  const macroRepository = new InMemoryMacroRepository()
  macroRepository.save({
    assumptions: [],
    description: 'Emergency escape sequence',
    enabled: true,
    id: 'panic-button',
    name: 'Panic Button',
    risk: 'caution',
    steps: [{ type: 'game-action', actionId: 'elite.ShipSpotLightToggle', operation: 'tap' }],
    version: 1
  })
  const systemSettingsRepository = new InMemorySystemSettingsRepository()
  enableCapabilities(systemSettingsRepository, 'command.macro.panic-button')
  const inputBackend = new RecordingKeyboardOutput()
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    keyboardOutput: inputBackend,
    macroRepository,
    port: 0,
    systemSettingsRepository
  })
  const address = await application.start()
  const provider = configuredProvider([
    response('macro-tools', [
      {
        arguments: { query: 'panic button' },
        callId: 'find-panic',
        name: 'phoenix__controls_find_actions',
        type: 'tool_call'
      },
      {
        arguments: { target: { macroId: 'panic-button', type: 'macro' } },
        callId: 'run-panic',
        name: 'phoenix__controls_execute_command',
        type: 'tool_call'
      }
    ], 'tool_calls'),
    response('macro-answer', [{ source: 'generated', text: 'Done.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({
    mcp: [{ name: 'phoenix', url: `http://${address.host}:${address.port}/mcp` }],
    provider
  })

  try {
    await client.user('Use the panic button.').run()
    const toolResults = provider.requests[1]?.messages.at(-1)?.content
    expect(toolResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        callId: 'find-panic',
        structuredContent: expect.objectContaining({
          matches: [expect.objectContaining({
            kind: 'macro',
            label: 'Panic Button',
            target: { macroId: 'panic-button', type: 'macro' }
          })]
        })
      }),
      expect.objectContaining({
        callId: 'run-panic',
        structuredContent: expect.objectContaining({
          commandId: 'command.macro.panic-button',
          status: 'accepted',
          target: { macroId: 'panic-button', type: 'macro' }
        })
      })
    ]))
    expect(inputBackend.getRecordedInputs()).toHaveLength(1)
  } finally {
    await application.stop()
  }
})

test('the Copilot discovers controls by integration-provided aliases', async () => {
  const systemSettingsRepository = new InMemorySystemSettingsRepository()
  enableCapabilities(systemSettingsRepository, 'command.elite.TargetNextRouteSystem')
  const application = new PhoenixApplication({
    eliteBindings: new StaticEliteDangerousBindings(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0,
    systemSettingsRepository
  })
  const address = await application.start()
  const provider = configuredProvider([
    response('alias-search', [{
      arguments: { query: 'target next jump' },
      callId: 'find-next-jump',
      name: 'phoenix__controls_find_actions',
      type: 'tool_call'
    }], 'tool_calls'),
    response('alias-answer', [{ source: 'generated', text: 'Found it.', type: 'text' }], 'stop')
  ])
  const client = createAiClient({
    mcp: [{ name: 'phoenix', url: `http://${address.host}:${address.port}/mcp` }],
    provider
  })

  try {
    await client.user('Can you find target next jump?').run()
    expect(provider.requests[1]?.messages.at(-1)?.content).toEqual([
      expect.objectContaining({
        callId: 'find-next-jump',
        structuredContent: expect.objectContaining({
          matches: [expect.objectContaining({
            commandId: 'command.elite.TargetNextRouteSystem',
            target: { actionId: 'elite.TargetNextRouteSystem', type: 'game-action' }
          })]
        }),
        type: 'tool_result'
      })
    ])
  } finally {
    await application.stop()
  }
})

function configuredProvider (responses: readonly ModelResponse[]): ConfiguredProvider & ScriptedProvider {
  const capabilities = textModelCapabilities()
  return Object.assign(new ScriptedProvider(
    responses.map(response => ({ response, type: 'generate' as const })),
    {
      capabilities: {
        ...capabilities,
        tools: { calls: true, parallelCalls: true, strictSchemas: true }
      }
    }
  ), { model: 'scripted-tools' })
}

function enableCapabilities (repository: InMemorySystemSettingsRepository, ...ids: string[]): void {
  const settings = repository.loadOrCreate()
  const enabledCapabilityIds = [...new Set([...settings.copilot.permissions.enabledCapabilityIds, ...ids])]
  const permissions = { version: 2 as const, enabledCapabilityIds }
  repository.save({
    ...settings,
    copilot: {
      ...settings.copilot,
      permissions,
      profilePermissions: { ...settings.copilot.profilePermissions, [settings.copilot.activeProfileId]: permissions }
    }
  })
}

function response (
  id: string,
  content: ConversationMessage['content'],
  finishReason: ModelResponse['finishReason']
): ModelResponse {
  return {
    finishReason,
    id,
    message: {
      content,
      conversationId: 'mcp-test',
      createdAt: '2026-08-10T20:00:00.000Z',
      id: `${id}-message`,
      role: 'assistant'
    },
    model: { model: 'scripted-tools', provider: 'scripted' },
    usage: { inputTokens: 1, outputTokens: 1 }
  }
}
