import type {
  JsonObject,
  JsonValue,
  LocalTool,
  ToolExecutionOutput
} from '@maduser/ai-ts'
import type { GameActionCategory, RuntimeState } from '@phoenix/contracts'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { GameActions } from './game-action-service.js'
import type { StatefulGameActionService } from './stateful-game-action-service.js'

export interface PhoenixMcpToolDependencies {
  gameActions: GameActions
  runtimeState: RuntimeStateReader
  statefulActions: StatefulGameActionService
}

export function createPhoenixMcpTools (dependencies: PhoenixMcpToolDependencies): LocalTool[] {
  return [
    currentStateTool(dependencies.runtimeState),
    findActionsTool(dependencies.gameActions),
    executeActionTool(dependencies.gameActions),
    setSwitchTool(dependencies.statefulActions)
  ]
}

function currentStateTool (runtimeState: RuntimeStateReader): LocalTool {
  return {
    definition: {
      annotations: { readOnly: true },
      description: 'Read a compact fresh PHOENIX telemetry snapshot: commander, system, location, ship, fuel, cargo, destination, and active status flags. Use when the request-time context may be stale or the commander asks for the current situation.',
      inputSchema: emptyObjectSchema(),
      name: 'commander.get_current_state'
    },
    execute: () => {
      const summary = summarizeRuntimeState(runtimeState.getCurrent())
      return output(runtimeStateText(summary), summary)
    }
  }
}

function findActionsTool (gameActions: GameActions): LocalTool {
  return {
    definition: {
      annotations: { readOnly: true },
      description: 'Find a small set of PHOENIX game actions by words from the commander request, label, action ID, description, or optional category. Use this before controls.execute or controls.set_switch when the exact action ID is unknown; do not request an unfiltered catalogue.',
      inputSchema: {
        additionalProperties: false,
        properties: {
          category: {
            enum: ['ship', 'combat', 'navigation', 'srv', 'on_foot', 'vessel', 'radio', 'emote', 'system', 'misc'],
            type: 'string'
          },
          limit: { maximum: 20, minimum: 1, type: 'integer' },
          query: { minLength: 1, type: 'string' }
        },
        required: ['query'],
        type: 'object'
      },
      name: 'controls.find_actions'
    },
    execute: arguments_ => {
      const query = stringArgument(arguments_, 'query')
      const searchTerms = actionSearchTerms(query)
      const category = optionalStringArgument(arguments_, 'category') as GameActionCategory | undefined
      const limit = optionalIntegerArgument(arguments_, 'limit') ?? 8
      const matches = gameActions.getCatalog().actions
        .filter(action => category === undefined || action.definition.category === category)
        .filter(action => actionMatches(action.definition, searchTerms))
        .slice(0, limit)
        .map(action => ({
          actionId: action.definition.id,
          available: action.available,
          binding: action.binding?.display ?? null,
          category: action.definition.category,
          inputMode: action.definition.inputMode,
          label: action.definition.label,
          risk: action.definition.risk,
          telemetryKey: action.definition.telemetryKey,
          unavailableReason: action.unavailableReason
        }))
      const text = matches.length === 0
        ? `No game actions matched "${query}".`
        : ['Matching game actions:', ...matches.map(action => (
            `- ${action.actionId}: ${action.label} (${action.category}, ${action.inputMode}, ${action.risk}); ${action.available ? `available${action.binding ? ` on ${action.binding}` : ''}` : `unavailable: ${action.unavailableReason}`}`
          ))].join('\n')
      return output(text, { matches, query })
    }
  }
}

function executeActionTool (gameActions: GameActions): LocalTool {
  return {
    definition: {
      annotations: { destructive: true, idempotent: false, openWorld: false },
      description: 'Execute one PHOENIX game action through the shared action gateway. Use only for a clear commander request. Use controls.find_actions first when the exact action ID is unknown. Tap actions use operation tap; hold actions require press or release. The result reports accepted input, not an invented telemetry confirmation.',
      inputSchema: {
        additionalProperties: false,
        properties: {
          actionId: { minLength: 1, type: 'string' },
          operation: { default: 'tap', enum: ['tap', 'press', 'release'], type: 'string' }
        },
        required: ['actionId'],
        type: 'object'
      },
      name: 'controls.execute'
    },
    execute: async arguments_ => {
      const result = await gameActions.execute({
        actionId: stringArgument(arguments_, 'actionId'),
        operation: optionalStringArgument(arguments_, 'operation') ?? 'tap'
      }, 'copilot')
      return output(result.message, json(result))
    }
  }
}

function setSwitchTool (statefulActions: StatefulGameActionService): LocalTool {
  return {
    definition: {
      annotations: { destructive: false, idempotent: true, openWorld: false },
      description: 'Set an observable toggle action such as ship lights, night vision, cargo scoop, landing gear, or hardpoints to a requested on/off state. This checks fresh telemetry, avoids toggling an already-satisfied state, and distinguishes confirmed from unconfirmed input.',
      inputSchema: {
        additionalProperties: false,
        properties: {
          actionId: { minLength: 1, type: 'string' },
          enabled: { type: 'boolean' }
        },
        required: ['actionId', 'enabled'],
        type: 'object'
      },
      name: 'controls.set_switch'
    },
    execute: async (arguments_, context) => {
      const result = await statefulActions.setSwitch({
        actionId: stringArgument(arguments_, 'actionId'),
        enabled: booleanArgument(arguments_, 'enabled')
      }, context.signal)
      return output(result.message, json(result))
    }
  }
}

function summarizeRuntimeState (state: RuntimeState): JsonObject {
  const status = state.gameStatus
  const activeFlags = status
    ? Object.entries({ ...status.flags, ...status.flags2 })
        .filter(([, enabled]) => enabled)
        .map(([flag]) => flag)
    : []
  const place = state.location.place
  return {
    revision: state.revision,
    updatedAt: state.updatedAt,
    commander: { name: state.commander.name },
    system: { name: state.system.name },
    location: {
      state: state.location.state,
      place: place === null ? null : { kind: place.kind, name: place.name, type: place.type }
    },
    ship: {
      cargoCapacity: state.ship.cargoCapacity,
      hull: state.ship.definition?.displayName ?? state.ship.typeId,
      identifier: state.ship.identifier,
      jumpRangeLy: state.ship.maxJumpRange,
      name: state.ship.name
    },
    status: status === null ? null : {
      activeFlags,
      cargoT: status.cargo,
      destination: status.destination?.name ?? null,
      fuelMainT: status.fuel?.main ?? null,
      fuelReservoirT: status.fuel?.reservoir ?? null,
      legalState: status.legalState,
      pips: status.pips
    }
  }
}

function runtimeStateText (summary: JsonObject): string {
  const commander = summary.commander as JsonObject
  const system = summary.system as JsonObject
  const location = summary.location as JsonObject
  const ship = summary.ship as JsonObject
  const status = summary.status as JsonObject | null
  const place = location.place as JsonObject | null
  const flags = status?.activeFlags as readonly JsonValue[] | undefined
  return [
    `Commander: ${commander.name ?? 'unknown'}`,
    `System: ${system.name ?? 'unknown'}; location: ${location.state}${place ? ` at ${place.name}` : ''}`,
    `Ship: ${ship.hull ?? 'unknown'}${ship.name ? ` "${ship.name}"` : ''}; jump range: ${ship.jumpRangeLy ?? 'unknown'} Ly; cargo capacity: ${ship.cargoCapacity ?? 'unknown'} T`,
    `Status: ${flags && flags.length > 0 ? flags.join(', ') : 'no active flags reported'}`
  ].join('\n')
}

function output (text: string, structuredContent: JsonValue): ToolExecutionOutput {
  return {
    content: [{ source: 'generated', text, type: 'text' }],
    structuredContent
  }
}

function emptyObjectSchema (): JsonObject {
  return { additionalProperties: false, properties: {}, type: 'object' }
}

function stringArgument (arguments_: JsonObject, key: string): string {
  const value = arguments_[key]
  if (typeof value !== 'string') throw new Error(`${key} must be a string.`)
  return value
}

function optionalStringArgument (arguments_: JsonObject, key: string): string | undefined {
  return arguments_[key] === undefined ? undefined : stringArgument(arguments_, key)
}

function optionalIntegerArgument (arguments_: JsonObject, key: string): number | undefined {
  const value = arguments_[key]
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be an integer.`)
  return value as number
}

function booleanArgument (arguments_: JsonObject, key: string): boolean {
  const value = arguments_[key]
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean.`)
  return value
}

const ACTION_SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'for', 'off', 'on', 'please', 'set', 'ship', 'switch', 'the', 'to', 'turn'
])

function actionSearchTerms (query: string): string[] {
  const normalized = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const meaningful = normalized.filter(term => !ACTION_SEARCH_STOP_WORDS.has(term))
  return meaningful.length > 0 ? meaningful : normalized
}

function actionMatches (
  action: { id: string, label: string, description: string, eliteBinding: string },
  terms: readonly string[]
): boolean {
  const haystack = [action.id, action.label, action.description, action.eliteBinding]
    .join(' ')
    .toLowerCase()
  return terms.every(term => haystack.includes(term))
}

function json (value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}
