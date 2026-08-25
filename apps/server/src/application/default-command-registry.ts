import {
  CommandCatalogResponseSchema,
  CommandDescriptorSchema,
  commandTargetKey,
  type CommandDescriptor,
  type CommandRisk,
  type CommandTarget
} from '@phoenix/contracts'
import type { GameActions } from './game-action-service.js'
import { effectiveMacroRisk } from './macro-risk.js'
import type { CommandRegistry, NavigationCommandDestination } from '../domain/commands.js'
import type { MacroRepository } from '../domain/macros.js'

export const PHOENIX_NAVIGATION_DESTINATIONS: readonly NavigationCommandDestination[] = [
  destination('information.home', 'Home', '#/', 'Information', 'Open the operational dashboard.'),
  destination('commander.career', 'Career', '#/commander/career', 'Commander', 'Open commander career progression and reputation.'),
  destination('commander.statistics', 'Statistics', '#/commander/statistics', 'Commander', 'Open commander lifetime statistics.'),
  destination('commander.inventory', 'Inventory', '#/commander/inventory', 'Commander', 'Open commander inventory.'),
  destination('fleet.overview', 'Fleet overview', '#/fleet/overview', 'Fleet', 'Open fleet overview.'),
  destination('fleet.current', 'Current ship', '#/fleet/current/overview', 'Fleet', 'Open the current ship overview.'),
  destination('fleet.current-loadout', 'Current loadout', '#/fleet/ships/current/loadout', 'Fleet', 'Open the current ship loadout.'),
  destination('fleet.current-cargo', 'Current cargo', '#/fleet/ships/current/cargo', 'Fleet', 'Open the current ship cargo.'),
  destination('fleet.carriers', 'Fleet carriers', '#/fleet/carriers', 'Fleet', 'Open fleet carriers.'),
  destination('fleet.stored-modules', 'Stored modules', '#/fleet/stored-modules', 'Fleet', 'Open stored modules.'),
  destination('fleet.catalogue', 'Ship catalogue', '#/fleet/catalogue', 'Fleet', 'Open the ship catalogue.'),
  destination('galaxy.current-system', 'Current system', '#/galaxy/system', 'Galaxy', 'Open the current system schematic.'),
  destination('galaxy.route', 'Plotted route', '#/galaxy/route', 'Galaxy', 'Open the plotted route.'),
  destination('galaxy.exobiology', 'Exobiology', '#/galaxy/exobiology', 'Galaxy', 'Open the exobiology tracker.'),
  destination('galaxy.database', 'Galaxy database', '#/galaxy/database', 'Galaxy', 'Open galaxy searches.'),
  destination('operations.overview', 'Operations', '#/operations/overview', 'Operations', 'Open current operations.'),
  destination('operations.missions', 'Missions', '#/operations/missions', 'Operations', 'Open current missions.'),
  destination('operations.objectives', 'Objectives', '#/operations/objectives', 'Operations', 'Open current objectives.'),
  destination('operations.community-goals', 'Community goals', '#/operations/community-goals', 'Operations', 'Open community goals.'),
  destination('operations.powerplay', 'Powerplay', '#/operations/powerplay', 'Operations', 'Open Powerplay operations.'),
  destination('operations.colonisation', 'Colonisation', '#/operations/colonisation', 'Operations', 'Open colonisation operations.'),
  destination('engineering.blueprints', 'Engineering', '#/engineering/blueprints', 'Engineering', 'Open engineering blueprints.'),
  destination('engineering.engineers', 'Engineers', '#/engineering/engineers', 'Engineering', 'Open engineers.'),
  destination('engineering.materials-raw', 'Raw materials', '#/engineering/materials/raw', 'Engineering', 'Open raw materials.'),
  destination('engineering.materials-manufactured', 'Manufactured materials', '#/engineering/materials/manufactured', 'Engineering', 'Open manufactured materials.'),
  destination('engineering.materials-encoded', 'Encoded materials', '#/engineering/materials/encoded', 'Engineering', 'Open encoded materials.'),
  destination('engineering.materials-xeno', 'Xeno materials', '#/engineering/materials/xeno', 'Engineering', 'Open xeno materials.'),
  destination('comms.overview', 'Comms', '#/comms/overview', 'Comms', 'Open communications.'),
  destination('comms.inbox', 'Inbox', '#/comms/inbox', 'Comms', 'Open message inbox.'),
  destination('comms.traffic', 'Traffic', '#/comms/traffic', 'Comms', 'Open communications traffic.'),
  destination('comms.contacts', 'Contacts', '#/comms/contacts', 'Comms', 'Open contacts.'),
  destination('comms.galnet', 'GalNet', '#/comms/galnet', 'Comms', 'Open GalNet.'),
  destination('comms.radio', 'GalNet radio', '#/comms/radio', 'Comms', 'Open GalNet radio controls.'),
  destination('records.journal', 'Journal', '#/records/journal', 'Records', 'Open the retained event journal.'),
  destination('records.exploration-ledger', 'Exploration ledger', '#/galaxy/exobiology', 'Records', 'Open the exploration ledger.'),
  destination('records.exploration-body', 'Body records', '#/records/exploration/body', 'Records', 'Open exploration body records.'),
  destination('records.exploration-biology', 'Biology', '#/galaxy/exobiology', 'Records', 'Open biology records.'),
  destination('records.exploration-geology', 'Geology', '#/records/exploration/geology', 'Records', 'Open geology records.'),
  destination('controls.ship', 'Ship controls', '#/controls/ship', 'Controls', 'Open the ship control grid.'),
  destination('copilot.channel', 'Copilot', '#copilot', 'Copilot', 'Open the Copilot channel.'),
  destination('macros.library', 'Macros', '#/macros', 'Macros', 'Open the macro library.'),
  destination('log.journal', 'Log', '#/records/journal', 'Log', 'Open the retained event journal.'),
  destination('settings.dashboard', 'Settings', '#/settings', 'Settings', 'Open PHOENIX settings.')
]

export class DefaultCommandRegistry implements CommandRegistry {
  public constructor (
    private readonly gameActions: GameActions,
    private readonly destinations: readonly NavigationCommandDestination[] = PHOENIX_NAVIGATION_DESTINATIONS,
    private readonly macros?: MacroRepository
  ) {}

  public find (target: CommandTarget): CommandDescriptor | undefined {
    return this.descriptors().get(commandTargetKey(target))
  }

  public getCatalog () {
    return CommandCatalogResponseSchema.parse({ commands: [...this.descriptors().values()] })
  }

  private descriptors (): Map<string, CommandDescriptor> {
    const descriptors = new Map<string, CommandDescriptor>()
    const gameActionCatalog = this.gameActions.getCatalog()
    for (const action of gameActionCatalog.actions) {
      const target = { type: 'game-action' as const, actionId: action.definition.id }
      descriptors.set(commandTargetKey(target), CommandDescriptorSchema.parse({
        activation: action.definition.inputMode,
        bindingLabel: action.binding?.display ?? null,
        id: `command.${action.definition.id}`,
        kind: target.type,
        label: action.definition.label,
        description: action.definition.description,
        category: action.definition.category,
        available: action.available,
        ...(action.unavailableReason ? { unavailableReason: action.unavailableReason } : {}),
        risk: actionRisk(action.definition.risk),
        target
      }))
    }
    for (const entry of this.destinations) {
      const target = { type: 'navigation' as const, destinationId: entry.id }
      descriptors.set(commandTargetKey(target), CommandDescriptorSchema.parse({
        activation: 'open',
        id: `command.navigation.${entry.id}`,
        kind: target.type,
        label: entry.label,
        description: entry.description,
        category: entry.category,
        available: true,
        risk: entry.risk ?? 'safe',
        target
      }))
    }
    for (const macro of this.macros?.getLibrary().macros ?? []) {
      const target = { type: 'macro' as const, macroId: macro.id }
      descriptors.set(commandTargetKey(target), CommandDescriptorSchema.parse({
        bindingLabel: 'Macro',
        id: `command.macro.${macro.id}`,
        kind: target.type,
        label: macro.name,
        ...(macro.description ? { description: macro.description } : {}),
        category: 'macros',
        available: macro.enabled,
        ...(!macro.enabled ? { unavailableReason: 'Macro is disabled.' } : {}),
        risk: effectiveMacroRisk(macro, gameActionCatalog),
        target
      }))
    }
    return descriptors
  }
}

function destination (
  id: string,
  label: string,
  href: string,
  category: string,
  description: string
): NavigationCommandDestination {
  return { category, description, href, id, label }
}

function actionRisk (risk: 'routine' | 'caution' | 'dangerous'): CommandRisk {
  return risk === 'routine' ? 'safe' : risk
}
