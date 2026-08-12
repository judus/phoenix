import { expect, test } from 'vitest'
import {
  createAiClient,
  type ConfiguredProvider,
  type ConversationMessage,
  type ModelResponse
} from '@judus/llm-client'
import { ScriptedProvider, textModelCapabilities } from '@judus/llm-client/testing'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('the portable AI client discovers and calls PHOENIX tools over MCP', async () => {
  const application = new PhoenixApplication({
    actionBindingResolver: new StaticGameActionBindingResolver(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const provider = configuredProvider([
    response('tool-step', [
      {
        arguments: {},
        callId: 'current-state-1',
        name: 'phoenix__commander_get_current_state',
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
        name: 'phoenix__ships_get_definition',
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
      'phoenix__commander_get_current_state',
      'phoenix__commander_get_inventory',
      'phoenix__commander_list_engineers',
      'phoenix__commander_list_materials',
      'phoenix__controls_find_actions',
      'phoenix__controls_execute',
      'phoenix__controls_get_status',
      'phoenix__controls_set_switch',
      'phoenix__controls_tap',
      'phoenix__display_show_body',
      'phoenix__display_show_system',
      'phoenix__exploration_get_current_body',
      'phoenix__navigation_can_jump_to',
      'phoenix__navigation_get_route',
      'phoenix__markets_find_best_trade',
      'phoenix__ship_get_cargo',
      'phoenix__ship_get_status',
      'phoenix__ship_list_modules',
      'phoenix__ships_compare',
      'phoenix__ships_get_definition',
      'phoenix__stations_find_nearest',
      'phoenix__stations_get_details',
      'phoenix__stations_list_shipyard_stock',
      'phoenix__stations_search_outfitting',
      'phoenix__systems_get_details'
    ])
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
          callId: 'find-lights-1',
          status: 'success',
          structuredContent: {
            matches: [{ actionId: 'elite.ShipSpotLightToggle', label: 'Ship Lights' }]
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
