import type { DisplayPageId } from '@phoenix/contracts'

interface DisplayPageDefinition {
  readonly label: string
  readonly aliases: readonly string[]
}

export const DISPLAY_PAGE_CATALOGUE = {
  'commander.dashboard': page('Command dashboard', 'dashboard', 'commander dashboard'),
  'commander.career': page('Commander career', 'career', 'ranks', 'commander ranks'),
  'commander.statistics': page('Lifetime statistics', 'statistics', 'commander statistics'),
  'commander.inventory': page('Personal stores', 'inventory', 'commander inventory', 'backpack', 'ship locker'),
  'commander.loadouts': page('Suit loadouts', 'loadouts', 'commander loadouts'),
  'equipment.gear': page('Personal equipment', 'equipment', 'gear', 'suits', 'personal weapons'),
  'equipment.upgrades': page('Personal equipment upgrades', 'equipment upgrades', 'suit upgrades', 'weapon upgrades'),
  'equipment.materials': page('Personal materials', 'on-foot materials', 'micro resources', 'ship locker materials'),
  'fleet.current': page('Current vessel', 'current ship', 'current vessel', 'ship dashboard'),
  'fleet.loadout': page('Current vessel loadout', 'ship loadout', 'modules'),
  'fleet.cargo': page('Current vessel cargo', 'ship cargo', 'cargo'),
  'fleet.engineering': page('Current vessel engineering', 'ship engineering'),
  'fleet.overview': page('Fleet overview', 'fleet'),
  'fleet.carriers': page('Fleet carriers', 'carriers'),
  'fleet.stored-modules': page('Stored modules', 'module storage'),
  'fleet.catalogue': page('Ship catalogue', 'ships catalogue', 'ship database'),
  'galaxy.system': page('Current system', 'system', 'system schematic'),
  'galaxy.route': page('Plotted route', 'current route', 'navigation route', 'route'),
  'galaxy.exobiology': page('Exobiology', 'biology', 'exo'),
  'galaxy.database': page('Galaxy database', 'galaxy search'),
  'activities.missions': page('Missions', 'mission list'),
  'activities.objectives': page('Objectives'),
  'activities.community-goals': page('Community goals'),
  'activities.powerplay': page('Powerplay'),
  'activities.colonisation': page('Colonisation'),
  'engineering.blueprints': page('Engineering blueprints', 'blueprints'),
  'engineering.projects': page('Engineering projects', 'material watchlist', 'engineering plans'),
  'engineering.engineers': page('Engineers'),
  'engineering.materials-raw': page('Raw materials', 'raw engineering materials'),
  'engineering.materials-manufactured': page('Manufactured materials', 'manufactured engineering materials'),
  'engineering.materials-encoded': page('Encoded materials', 'encoded engineering materials'),
  'engineering.materials-xeno': page('Xeno materials', 'alien materials'),
  'comms.inbox': page('Inbox', 'messages', 'communications', 'comms'),
  'comms.traffic': page('Traffic'),
  'comms.contacts': page('Correspondents', 'contacts'),
  'comms.galnet': page('GalNet', 'galnet news'),
  'comms.radio': page('GalNet Radio', 'radio', 'galnet audio'),
  'controls.ship': page('Ship controls', 'ship control deck'),
  'controls.combat': page('Combat controls', 'combat control deck'),
  'controls.navigation': page('Navigation controls', 'navigation control deck'),
  'controls.vessel': page('Vessel controls', 'vessel control deck'),
  'controls.srv': page('SRV controls', 'scarab controls'),
  'controls.on-foot': page('On-foot controls', 'on foot controls'),
  'controls.radio': page('Radio controls', 'radio control deck'),
  'controls.emote': page('Emote controls', 'emotes'),
  'controls.misc': page('Miscellaneous controls', 'misc controls'),
  'copilot.chat': page('Copilot', 'copilot chat'),
  'copilot.profiles': page('Copilot profiles', 'profiles'),
  numpad: page('Numpy', 'numpad', 'numeric navigation'),
  macros: page('Macros'),
  journal: page('Journal', 'journal log', 'elite journal'),
  credits: page('Credits', 'data sources'),
  settings: page('Settings'),
  help: page('Help', 'manual'),
  'developer.overview': page('Developer tools', 'developer overview'),
  'developer.runtime': page('Runtime diagnostics', 'runtime'),
  'developer.elite': page('Elite diagnostics'),
  'developer.health': page('Health diagnostics', 'health'),
  'developer.tests': page('Developer tests', 'tests'),
  'developer.controls': page('Control diagnostics', 'controls diagnostics')
} as const satisfies Record<DisplayPageId, DisplayPageDefinition>

export function resolveDisplayPage (input: string): { id: DisplayPageId, label: string } {
  const requested = normalize(input)
  if (!requested) throw new Error('Provide the PHOENIX page to open.')

  const matches = (Object.entries(DISPLAY_PAGE_CATALOGUE) as Array<[DisplayPageId, DisplayPageDefinition]>)
    .filter(([id, definition]) => [id, definition.label, ...definition.aliases].some(candidate => normalize(candidate) === requested))

  if (matches.length === 1) return { id: matches[0]![0], label: matches[0]![1].label }
  if (matches.length > 1) {
    throw new Error(`The page name "${input}" is ambiguous: ${matches.map(([, definition]) => definition.label).join(', ')}.`)
  }
  throw new Error(`No PHOENIX page matches "${input}".`)
}

function page (label: string, ...aliases: string[]): DisplayPageDefinition {
  return { aliases, label }
}

const NAVIGATION_WORDS = new Set([
  'bring',
  'display',
  'go',
  'me',
  'navigate',
  'open',
  'page',
  'phoenix',
  'please',
  'screen',
  'show',
  'take',
  'the',
  'to',
  'up',
  'view'
])

function normalize (value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(word => word && !NAVIGATION_WORDS.has(word))
    .join(' ')
}
