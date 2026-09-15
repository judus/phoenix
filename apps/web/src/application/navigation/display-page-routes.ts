import type { DisplayCommand, DisplayPageId } from '@phoenix/contracts'
import type { PhoenixRoute } from './phoenix-route.js'

const DISPLAY_PAGE_ROUTES = {
  'commander.dashboard': { kind: 'information', section: 'commander', view: 'dashboard' },
  'commander.career': { kind: 'information', section: 'commander', view: 'career' },
  'commander.statistics': { kind: 'information', section: 'commander', view: 'statistics' },
  'commander.inventory': { kind: 'information', section: 'commander', view: 'inventory' },
  'commander.equipment': { kind: 'information', section: 'commander', view: 'equipment' },
  'fleet.current': { kind: 'information', section: 'fleet', view: 'current-overview' },
  'fleet.loadout': { kind: 'information', section: 'fleet', view: 'current-loadout' },
  'fleet.cargo': { kind: 'information', section: 'fleet', view: 'current-cargo' },
  'fleet.engineering': { kind: 'information', section: 'fleet', view: 'current-engineering' },
  'fleet.overview': { kind: 'information', section: 'fleet', view: 'overview' },
  'fleet.carriers': { kind: 'information', section: 'fleet', view: 'carriers' },
  'fleet.stored-modules': { kind: 'information', section: 'fleet', view: 'stored-modules' },
  'fleet.catalogue': { kind: 'information', section: 'fleet', view: 'catalogue' },
  'galaxy.system': { kind: 'information', section: 'galaxy', view: 'system' },
  'galaxy.route': { kind: 'information', section: 'galaxy', view: 'route' },
  'galaxy.exobiology': { kind: 'information', section: 'galaxy', view: 'exobiology' },
  'galaxy.database': { kind: 'information', section: 'galaxy', view: 'database' },
  'activities.missions': { kind: 'information', section: 'activities', view: 'missions' },
  'activities.objectives': { kind: 'information', section: 'activities', view: 'objectives' },
  'activities.community-goals': { kind: 'information', section: 'activities', view: 'community-goals' },
  'activities.powerplay': { kind: 'information', section: 'activities', view: 'powerplay' },
  'activities.colonisation': { kind: 'information', section: 'activities', view: 'colonisation' },
  'engineering.blueprints': { kind: 'information', section: 'engineering', view: 'blueprints' },
  'engineering.projects': { kind: 'information', section: 'engineering', view: 'projects' },
  'engineering.engineers': { kind: 'information', section: 'engineering', view: 'engineers' },
  'engineering.materials-raw': { kind: 'information', section: 'engineering', view: 'materials-raw' },
  'engineering.materials-manufactured': { kind: 'information', section: 'engineering', view: 'materials-manufactured' },
  'engineering.materials-encoded': { kind: 'information', section: 'engineering', view: 'materials-encoded' },
  'engineering.materials-xeno': { kind: 'information', section: 'engineering', view: 'materials-xeno' },
  'comms.inbox': { kind: 'information', section: 'comms', view: 'inbox' },
  'comms.traffic': { kind: 'information', section: 'comms', view: 'traffic' },
  'comms.contacts': { kind: 'information', section: 'comms', view: 'contacts' },
  'comms.galnet': { kind: 'information', section: 'comms', view: 'galnet' },
  'comms.radio': { kind: 'information', section: 'comms', view: 'radio' },
  'controls.ship': { kind: 'controls', category: 'ship' },
  'controls.combat': { kind: 'controls', category: 'combat' },
  'controls.navigation': { kind: 'controls', category: 'navigation' },
  'controls.vessel': { kind: 'controls', category: 'vessel' },
  'controls.srv': { kind: 'controls', category: 'srv' },
  'controls.on-foot': { kind: 'controls', category: 'on_foot' },
  'controls.radio': { kind: 'controls', category: 'radio' },
  'controls.emote': { kind: 'controls', category: 'emote' },
  'controls.misc': { kind: 'controls', category: 'misc' },
  'copilot.chat': { kind: 'copilot', view: 'chat' },
  'copilot.profiles': { kind: 'copilot', view: 'profiles' },
  numpad: { kind: 'numpad' },
  macros: { kind: 'macros' },
  journal: { kind: 'journal', view: 'journal' },
  credits: { kind: 'journal', view: 'credits' },
  settings: { kind: 'settings', view: 'dashboard' },
  help: { kind: 'settings', view: 'help' },
  'developer.overview': { kind: 'developer', view: 'overview' },
  'developer.runtime': { kind: 'developer', view: 'runtime' },
  'developer.elite': { kind: 'developer', view: 'elite' },
  'developer.health': { kind: 'developer', view: 'health' },
  'developer.tests': { kind: 'developer', view: 'tests' },
  'developer.controls': { kind: 'developer', view: 'controls' }
} as const satisfies Record<DisplayPageId, PhoenixRoute>

export function routeForDisplayPage (pageId: DisplayPageId): PhoenixRoute {
  return DISPLAY_PAGE_ROUTES[pageId]
}

export function routeForDisplayCommand (command: DisplayCommand): PhoenixRoute {
  if (command.type === 'open_page') return routeForDisplayPage(command.pageId)
  return {
    kind: 'information',
    section: 'galaxy',
    view: 'system',
    systemName: command.systemName,
    ...(command.selectedName ? { selectedName: command.selectedName } : {})
  }
}
