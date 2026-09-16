import type { ToolDefinition } from '@jdu/llm-client'
import {
  CopilotCapabilityCatalogueSchema,
  CopilotPermissionPolicySchema,
  CopilotProfileCapabilitySettingsSchema,
  type CommandDescriptor,
  type CommandTarget,
  type CopilotCapability,
  type CopilotCapabilityGroup,
  type CopilotCapabilitySubgroup,
  type CopilotPermissionPolicy
} from '@phoenix/contracts'
import type { CommandRegistry } from '../domain/commands.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'
import {
  COPILOT_CONTROL_TOOL_NAMES,
  type CopilotCapabilities,
  toolCapabilityId
} from '../domain/copilot-capabilities.js'

const FIXED_GROUPS: ReadonlyArray<{ id: string, label: string, prefixes: readonly string[] }> = [
  { id: 'commander', label: 'Commander', prefixes: ['commander.'] },
  { id: 'fleet', label: 'Fleet', prefixes: ['ship.', 'ships.', 'fleet.'] },
  { id: 'galaxy', label: 'Galaxy', prefixes: ['systems.', 'navigation.', 'exploration.', 'factions.', 'markets.', 'stations.'] },
  { id: 'activities', label: 'Activities', prefixes: ['missions.'] },
  { id: 'engineering', label: 'Engineering', prefixes: ['engineering.'] },
  { id: 'equipment', label: 'Equipment', prefixes: ['equipment.'] },
  { id: 'comms', label: 'Comms', prefixes: ['comms.'] },
  { id: 'display', label: 'Display', prefixes: ['display.'] },
  { id: 'external', label: 'External', prefixes: ['web.'] }
]

const CONTROL_TOOL_NAMES = new Set<string>(COPILOT_CONTROL_TOOL_NAMES)

const CONTROL_CONTEXTS = [
  { id: 'general', label: 'General' },
  { id: 'ship', label: 'Ship' },
  { id: 'srv', label: 'SRV' },
  { id: 'on-foot', label: 'On foot' },
  { id: 'emotes', label: 'Emotes' }
] as const

type ControlContextId = typeof CONTROL_CONTEXTS[number]['id']

export class DefaultCopilotCapabilityService implements CopilotCapabilities {
  public constructor (
    private readonly toolDefinitions: () => readonly ToolDefinition[],
    private readonly commands: CommandRegistry,
    private readonly settings: SystemSettingsRepository
  ) {}

  public catalogue (policy?: CopilotPermissionPolicy) {
    const enabled = new Set((policy ?? this.settings.loadOrCreate().copilot.permissions).enabledCapabilityIds)
    const fixed = this.fixedCapabilities(enabled)
    const dynamic = this.commandCapabilities(enabled)
    const groups: CopilotCapabilityGroup[] = [
      ...FIXED_GROUPS.map(group => ({
        id: `tools.${group.id}`,
        label: group.label,
        capabilities: fixed.filter(capability => capabilityGroup(capability.id) === group.id),
        subgroups: []
      })).filter(group => group.capabilities.length > 0),
      ...dynamic
    ]
    const capabilities = groups.flatMap(groupCapabilities)
    const selected = capabilities.filter(capability => capability.enabled)
    const score = selected.reduce((total, capability) => total + capability.loadCost, 0)
    const fixedTools = selected.filter(capability => capability.kind === 'fixed-tool').length
    const gameActions = selected.filter(capability => capability.kind === 'game-action').length
    const macros = selected.filter(capability => capability.kind === 'macro').length
    return CopilotCapabilityCatalogueSchema.parse({
      groups,
      load: {
        score,
        percentage: Math.min(100, score),
        level: score <= 60 ? 'focused' : score <= 90 ? 'broad' : 'overloaded',
        enabled: { fixedTools, gameActions, macros, total: selected.length }
      }
    })
  }

  public normalizePolicy (candidate: CopilotPermissionPolicy, ceiling?: CopilotPermissionPolicy): CopilotPermissionPolicy {
    const policy = CopilotPermissionPolicySchema.parse(candidate)
    const known = new Set(this.catalogue({ version: 2, enabledCapabilityIds: [] }).groups.flatMap(groupCapabilities).map(capability => capability.id))
    const allowed = ceiling === undefined ? known : new Set(ceiling.enabledCapabilityIds.filter(id => known.has(id)))
    return CopilotPermissionPolicySchema.parse({
      version: 2,
      enabledCapabilityIds: policy.enabledCapabilityIds.filter(id => allowed.has(id))
    })
  }

  public profilePolicy (profileId: string): CopilotPermissionPolicy {
    const settings = this.settings.loadOrCreate()
    const profile = settings.copilot.profilePermissions[profileId] ?? { version: 2 as const, enabledCapabilityIds: [] }
    return this.normalizePolicy(profile, settings.copilot.permissions)
  }

  public profileSettings (profileId: string) {
    const settings = this.settings.loadOrCreate()
    const permissions = this.profilePolicy(profileId)
    return CopilotProfileCapabilitySettingsSchema.parse({
      profileId,
      permissions,
      installationPermissions: settings.copilot.permissions,
      capabilities: this.catalogue(permissions)
    })
  }

  public saveInstallationPolicy (candidate: CopilotPermissionPolicy): CopilotPermissionPolicy {
    const permissions = this.normalizePolicy(candidate)
    const settings = this.settings.loadOrCreate()
    const profilePermissions = Object.fromEntries(Object.entries(settings.copilot.profilePermissions)
      .map(([profileId, profilePolicy]) => [profileId, this.normalizePolicy(profilePolicy, permissions)]))
    this.settings.save({
      ...settings,
      copilot: { ...settings.copilot, permissions, profilePermissions }
    })
    return permissions
  }

  public saveProfilePolicy (profileId: string, candidate: CopilotPermissionPolicy) {
    const settings = this.settings.loadOrCreate()
    const permissions = this.normalizePolicy(candidate, settings.copilot.permissions)
    this.settings.save({
      ...settings,
      copilot: {
        ...settings.copilot,
        profilePermissions: { ...settings.copilot.profilePermissions, [profileId]: permissions }
      }
    })
    return this.profileSettings(profileId)
  }

  public isCommandEnabled (target: CommandTarget): boolean {
    const descriptor = this.commands.find(target)
    return descriptor !== undefined && this.isDescriptorEnabled(descriptor)
  }

  public isDescriptorEnabled (descriptor: CommandDescriptor): boolean {
    return descriptor.kind !== 'navigation' && this.enabledIds().has(descriptor.id)
  }

  public isToolEnabled (name: string): boolean {
    if (CONTROL_TOOL_NAMES.has(name)) {
      const enabledCommands = this.commands.getCatalog().commands.filter(command => this.isDescriptorEnabled(command))
      if (name === 'controls.set_control_state') return enabledCommands.some(command => command.kind === 'game-action')
      return enabledCommands.length > 0
    }
    return this.enabledIds().has(toolCapabilityId(name))
  }

  private enabledIds (): Set<string> {
    const settings = this.settings.loadOrCreate()
    const profile = settings.copilot.profilePermissions[settings.copilot.activeProfileId] ?? { version: 2 as const, enabledCapabilityIds: [] }
    return new Set(this.normalizePolicy(profile, settings.copilot.permissions).enabledCapabilityIds)
  }

  private fixedCapabilities (enabled: ReadonlySet<string>): CopilotCapability[] {
    return this.toolDefinitions()
      .filter(definition => !CONTROL_TOOL_NAMES.has(definition.name))
      .map(definition => {
        const id = toolCapabilityId(definition.name)
        return {
          id,
          label: humanize(definition.name.slice(definition.name.indexOf('.') + 1)),
          description: definition.description,
          kind: 'fixed-tool' as const,
          access: fixedAccess(definition),
          available: true,
          enabled: enabled.has(id),
          loadCost: 1 + Math.ceil(JSON.stringify(definition).length / 1000),
          risk: null
        }
      })
  }

  private commandCapabilities (enabled: ReadonlySet<string>): CopilotCapabilityGroup[] {
    const descriptors = this.commands.getCatalog().commands.filter(command => command.kind !== 'navigation')
    const gameActions = new Map<ControlContextId, CommandDescriptor[]>(
      CONTROL_CONTEXTS.map(context => [context.id, []])
    )
    const macros: CommandDescriptor[] = []
    for (const descriptor of descriptors) {
      if (descriptor.kind === 'macro') {
        macros.push(descriptor)
      } else {
        gameActions.get(controlContext(descriptor))!.push(descriptor)
      }
    }
    const controlSubgroups: CopilotCapabilitySubgroup[] = CONTROL_CONTEXTS.flatMap(context => {
      const commands = gameActions.get(context.id) ?? []
      return commands.length === 0 ? [] : [{
        id: `controls.${context.id}`,
        label: context.label,
        capabilities: commands
          .sort((left, right) => left.label.localeCompare(right.label))
          .map(command => commandCapability(command, enabled))
      }]
    })
    return [
      ...(controlSubgroups.length === 0 ? [] : [{
        id: 'controls',
        label: 'Controls',
        capabilities: [],
        subgroups: controlSubgroups
      }]),
      ...(macros.length === 0 ? [] : [{
        id: 'controls.macros',
        label: 'Macros',
        capabilities: macros
          .sort((left, right) => left.label.localeCompare(right.label))
          .map(command => commandCapability(command, enabled)),
        subgroups: []
      }])
    ]
  }
}

function groupCapabilities (group: CopilotCapabilityGroup): CopilotCapability[] {
  return [
    ...group.capabilities,
    ...group.subgroups.flatMap(subgroup => subgroup.capabilities)
  ]
}

function commandCapability (descriptor: CommandDescriptor, enabled: ReadonlySet<string>): CopilotCapability {
  return {
    id: descriptor.id,
    label: descriptor.label,
    description: descriptor.description ?? `${descriptor.label} control.`,
    kind: descriptor.kind === 'macro' ? 'macro' : 'game-action',
    access: 'control',
    available: descriptor.available,
    enabled: enabled.has(descriptor.id),
    loadCost: descriptor.kind === 'macro' ? 2 : 1,
    risk: descriptor.risk
  }
}

function capabilityGroup (id: string): string {
  const toolName = id.slice('tool:'.length)
  const group = FIXED_GROUPS.find(group => group.prefixes.some(prefix => toolName.startsWith(prefix)))
  if (!group) throw new Error(`Copilot tool ${toolName} has no PHOENIX capability domain.`)
  return group.id
}

function controlContext (descriptor: CommandDescriptor): ControlContextId {
  const actionId = descriptor.target.type === 'game-action' ? descriptor.target.actionId.toLowerCase() : ''
  if (descriptor.category === 'emote' || actionId.includes('humanoidemote')) return 'emotes'
  if (descriptor.category === 'srv' || actionId.includes('buggy')) return 'srv'
  if (descriptor.category === 'on_foot' || actionId.includes('humanoid')) return 'on-foot'
  if (['combat', 'navigation', 'ship', 'vessel'].includes(descriptor.category)) return 'ship'
  return 'general'
}

function fixedAccess (definition: ToolDefinition): CopilotCapability['access'] {
  if (definition.name.startsWith('display.')) return 'display'
  if (definition.name.startsWith('web.') || definition.annotations?.openWorld === true) return 'external'
  return 'read'
}

function humanize (value: string): string {
  return value.replaceAll(/[._-]+/gu, ' ').replaceAll(/\b\p{L}/gu, letter => letter.toUpperCase())
}
