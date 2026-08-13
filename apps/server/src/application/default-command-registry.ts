import {
  CommandCatalogResponseSchema,
  CommandDescriptorSchema,
  commandTargetKey,
  type CommandDescriptor,
  type CommandRisk,
  type CommandTarget
} from '@phoenix/contracts'
import type { GameActions } from './game-action-service.js'
import type { CommandRegistry, NavigationCommandDestination } from '../domain/commands.js'

export const PHOENIX_NAVIGATION_DESTINATIONS: readonly NavigationCommandDestination[] = [
  destination('information.home', 'Home', '#/', 'Information', 'Open the operational dashboard.'),
  destination('commander.overview', 'Commander', '#/commander/overview', 'Commander', 'Open commander overview.'),
  destination('fleet.current', 'Current ship', '#/fleet/current/overview', 'Fleet', 'Open the current ship overview.'),
  destination('galaxy.current-system', 'Current system', '#/galaxy/system', 'Galaxy', 'Open the current system schematic.'),
  destination('galaxy.route', 'Plotted route', '#/galaxy/route', 'Galaxy', 'Open the plotted route.'),
  destination('galaxy.database', 'Galaxy database', '#/galaxy/database', 'Galaxy', 'Open galaxy searches.'),
  destination('operations.overview', 'Operations', '#/operations/overview', 'Operations', 'Open current operations.'),
  destination('engineering.blueprints', 'Engineering', '#/engineering/blueprints', 'Engineering', 'Open engineering blueprints.'),
  destination('comms.overview', 'Comms', '#/comms/overview', 'Comms', 'Open communications.'),
  destination('records.journal', 'Journal', '#/records/journal', 'Records', 'Open the retained event journal.'),
  destination('controls.ship', 'Ship controls', '#/controls/ship', 'Controls', 'Open the ship control grid.'),
  destination('copilot.channel', 'Copilot', '#copilot', 'Copilot', 'Open the Copilot channel.')
]

export class DefaultCommandRegistry implements CommandRegistry {
  public constructor (
    private readonly gameActions: GameActions,
    private readonly destinations: readonly NavigationCommandDestination[] = PHOENIX_NAVIGATION_DESTINATIONS
  ) {}

  public find (target: CommandTarget): CommandDescriptor | undefined {
    return this.descriptors().get(commandTargetKey(target))
  }

  public getCatalog () {
    return CommandCatalogResponseSchema.parse({ commands: [...this.descriptors().values()] })
  }

  private descriptors (): Map<string, CommandDescriptor> {
    const descriptors = new Map<string, CommandDescriptor>()
    for (const action of this.gameActions.getCatalog().actions) {
      const target = { type: 'game-action' as const, actionId: action.definition.id }
      descriptors.set(commandTargetKey(target), CommandDescriptorSchema.parse({
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
