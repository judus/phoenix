import { expect, test } from 'vitest'
import type { LocalTool } from '@jdu/llm-client'
import {
  CommandDescriptorSchema,
  commandTargetKey,
  type CommandDescriptor,
  type CommandTarget
} from '@phoenix/contracts'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { CopilotToolRegistry } from '../apps/server/src/application/copilot-tool-registry.js'
import type { CommandRegistry } from '../apps/server/src/domain/commands.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

test('capability policy filters fixed schemas and derives the generic control tools', async () => {
  const tools = [
    tool('commander.get_current_situation'),
    tool('web.search_web'),
    tool('controls.find_actions'),
    tool('controls.execute_command'),
    tool('controls.set_control_state')
  ]
  const commands = new StubCommandRegistry([
    command('command.elite.Lights', 'elite.Lights', 'Ship lights')
  ])
  const settings = new InMemorySystemSettingsRepository()
  saveCapabilities(settings, ['tool:commander.get_current_situation', 'command.elite.Lights'])
  const capabilities = new DefaultCopilotCapabilityService(
    () => tools.map(tool => tool.definition),
    commands,
    settings
  )
  const registry = new CopilotToolRegistry(tools, capabilities)

  expect(registry.definitions.map(definition => definition.name)).toEqual([
    'commander.get_current_situation',
    'controls.find_actions',
    'controls.execute_command',
    'controls.set_control_state'
  ])
  await expect(registry.execute({ arguments: {}, id: 'call-1', name: 'web.search_web' }, executionContext()))
    .rejects.toThrow('disabled in Settings')

  saveCapabilities(settings, ['tool:commander.get_current_situation'])
  expect(registry.definitions.map(definition => definition.name)).toEqual(['commander.get_current_situation'])
})

test('AI load reflects individually enabled tools, controls, and macros', () => {
  const tools = [tool('commander.get_current_situation'), tool('web.search_web')]
  const descriptors = [
    ...Array.from({ length: 91 }, (_, index) => command(`command.elite.Action${index}`, `elite.Action${index}`, `Action ${index}`)),
    command('command.macro.departure', 'departure', 'Departure macro', 'macro')
  ]
  const settings = new InMemorySystemSettingsRepository()
  saveCapabilities(settings, descriptors.map(descriptor => descriptor.id))
  const capabilities = new DefaultCopilotCapabilityService(
    () => tools.map(tool => tool.definition),
    new StubCommandRegistry(descriptors),
    settings
  )

  expect(capabilities.catalogue().load).toEqual({
    score: 93,
    percentage: 93,
    level: 'overloaded',
    enabled: { fixedTools: 0, gameActions: 91, macros: 1, total: 92 }
  })
})

test('active profile permissions are constrained by and pruned with the installation ceiling', () => {
  const settings = new InMemorySystemSettingsRepository()
  const capabilities = new DefaultCopilotCapabilityService(
    () => [tool('commander.get_current_situation'), tool('web.search_web')].map(tool => tool.definition),
    new StubCommandRegistry([]),
    settings
  )

  capabilities.saveInstallationPolicy({
    version: 2,
    enabledCapabilityIds: ['tool:commander.get_current_situation', 'tool:web.search_web']
  })
  capabilities.saveProfilePolicy('marin', {
    version: 2,
    enabledCapabilityIds: ['tool:commander.get_current_situation']
  })

  expect(capabilities.isToolEnabled('commander.get_current_situation')).toBe(true)
  expect(capabilities.isToolEnabled('web.search_web')).toBe(false)

  capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: ['tool:web.search_web'] })

  expect(capabilities.profilePolicy('marin').enabledCapabilityIds).toEqual([])
  expect(capabilities.isToolEnabled('commander.get_current_situation')).toBe(false)
})

test('game controls are grouped by game context rather than source category', () => {
  const descriptors = [
    command('command.elite.FocusLeftPanel', 'elite.FocusLeftPanel', 'Focus left panel', 'game-action', 'misc'),
    command('command.elite.PrimaryFire', 'elite.PrimaryFire', 'Primary fire', 'game-action', 'combat'),
    command('command.elite.FocusCommsPanel_Buggy', 'elite.FocusCommsPanel_Buggy', 'Focus comms panel', 'game-action', 'radio'),
    command('command.elite.HumanoidPrimaryFireButton', 'elite.HumanoidPrimaryFireButton', 'Primary fire', 'game-action', 'misc'),
    command('command.elite.HumanoidEmoteSlot1', 'elite.HumanoidEmoteSlot1', 'Emote 1', 'game-action', 'on_foot')
  ]
  const capabilities = new DefaultCopilotCapabilityService(
    () => [],
    new StubCommandRegistry(descriptors),
    new InMemorySystemSettingsRepository()
  )

  const groups = capabilities.catalogue().groups
  const controls = groups.find(group => group.id === 'controls')

  expect(groups.filter(group => group.id === 'controls')).toHaveLength(1)
  expect(controls?.subgroups.map(subgroup => [
    subgroup.id,
    subgroup.capabilities.map(capability => capability.id)
  ])).toEqual([
    ['controls.general', ['command.elite.FocusLeftPanel']],
    ['controls.ship', ['command.elite.PrimaryFire']],
    ['controls.srv', ['command.elite.FocusCommsPanel_Buggy']],
    ['controls.on-foot', ['command.elite.HumanoidPrimaryFireButton']],
    ['controls.emotes', ['command.elite.HumanoidEmoteSlot1']]
  ])
})

test('fixed tools follow PHOENIX product domains rather than implementation namespaces', () => {
  const tools = [
    tool('commander.get_current_situation'),
    tool('engineering.list_engineers'),
    tool('ship.get_current_ship_status'),
    tool('markets.find_commodity_markets'),
    tool('missions.list_missions'),
    tool('equipment.get_equipment_report'),
    tool('comms.list_messages'),
    tool('display.open_page'),
    tool('web.search_web')
  ]
  const capabilities = new DefaultCopilotCapabilityService(
    () => tools.map(tool => tool.definition),
    new StubCommandRegistry([]),
    new InMemorySystemSettingsRepository()
  )

  expect(capabilities.catalogue().groups.map(group => [
    group.label,
    group.capabilities.map(capability => capability.id)
  ])).toEqual([
    ['Commander', ['tool:commander.get_current_situation']],
    ['Fleet', ['tool:ship.get_current_ship_status']],
    ['Galaxy', ['tool:markets.find_commodity_markets']],
    ['Activities', ['tool:missions.list_missions']],
    ['Engineering', ['tool:engineering.list_engineers']],
    ['Equipment', ['tool:equipment.get_equipment_report']],
    ['Comms', ['tool:comms.list_messages']],
    ['Display', ['tool:display.open_page']],
    ['External', ['tool:web.search_web']]
  ])
})

function tool (name: string): LocalTool {
  return {
    definition: {
      description: `Use ${name}.`,
      inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
      name
    },
    execute: () => ({ structuredContent: { ok: true } })
  }
}

function command (
  id: string,
  targetId: string,
  label: string,
  kind: 'game-action' | 'macro' = 'game-action',
  category: string = kind === 'macro' ? 'macros' : 'ship'
): CommandDescriptor {
  const target = kind === 'macro'
    ? { type: 'macro' as const, macroId: targetId }
    : { type: 'game-action' as const, actionId: targetId }
  return CommandDescriptorSchema.parse({
    id,
    kind,
    activation: 'tap',
    label,
    description: `${label}.`,
    category,
    available: true,
    risk: 'safe',
    target,
    bindingLabel: null
  })
}

class StubCommandRegistry implements CommandRegistry {
  public constructor (private readonly commands: readonly CommandDescriptor[]) {}
  public find (target: CommandTarget): CommandDescriptor | undefined {
    return this.commands.find(command => commandTargetKey(command.target) === commandTargetKey(target))
  }
  public getCatalog () { return { commands: [...this.commands] } }
}

function saveCapabilities (repository: InMemorySystemSettingsRepository, enabledCapabilityIds: string[]): void {
  const settings = repository.loadOrCreate()
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

function executionContext () {
  return {
    callId: 'call-1',
    deadline: new Date(Date.now() + 1000).toISOString(),
    runId: 'run-1',
    signal: new AbortController().signal
  }
}
