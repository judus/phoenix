import type { GalaxyQueryId } from '../../application/navigation/phoenix-route.js'

export interface GalaxyQueryFieldOption {
  label: string
  value: string
}

export interface GalaxyQueryField {
  id: string
  hint?: string
  label: string
  max?: number
  min?: number
  options?: GalaxyQueryFieldOption[]
  placeholder?: string
  required?: boolean
  type: 'date' | 'multi-select' | 'number' | 'select' | 'text'
}

export type GalaxyQueryValue = string | string[]

export interface GalaxyQueryDefinition {
  defaults: Record<string, GalaxyQueryValue>
  domain: 'Cartography' | 'Facilities' | 'Markets' | 'Politics'
  fields: GalaxyQueryField[]
  id: GalaxyQueryId
  purpose: string
  title: string
}

const ORIGIN: GalaxyQueryField = { id: 'origin', label: 'Reference system', required: true, type: 'text' }
const RADIUS: GalaxyQueryField = { id: 'radius', label: 'Maximum distance (ly)', min: 1, max: 500, required: true, type: 'number' }
const PAD: GalaxyQueryField = {
  id: 'pad',
  label: 'Minimum landing pad',
  options: [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' }
  ],
  required: true,
  type: 'select'
}
const MAX_AGE: GalaxyQueryField = { id: 'maxDaysAgo', label: 'Maximum report age (days)', min: 1, max: 365, required: true, type: 'number' }

const BODY_SUBTYPES = options([
  'Ammonia world',
  'Class I gas giant',
  'Class II gas giant',
  'Class III gas giant',
  'Class IV gas giant',
  'Class V gas giant',
  'Earth-like world',
  'Gas giant with ammonia-based life',
  'Gas giant with water-based life',
  'Helium gas giant',
  'Helium-rich gas giant',
  'High metal content world',
  'Icy body',
  'Metal-rich body',
  'Rocky Ice world',
  'Rocky body',
  'Water giant',
  'Water world'
])

const ATMOSPHERES = options([
  'Ammonia', 'Ammonia and Oxygen', 'Ammonia-rich', 'Argon', 'Argon-rich',
  'Carbon dioxide', 'Carbon dioxide-rich', 'Helium', 'Hot Argon', 'Hot Argon-rich',
  'Hot Carbon dioxide', 'Hot Carbon dioxide-rich', 'Hot Metallic vapour', 'Hot Silicate vapour',
  'Hot Sulphur dioxide', 'Hot Water', 'Hot Water-rich', 'Hot thick Ammonia',
  'Hot thick Ammonia-rich', 'Hot thick Argon', 'Hot thick Argon-rich', 'Hot thick Carbon dioxide',
  'Hot thick Carbon dioxide-rich', 'Hot thick Metallic vapour', 'Hot thick Methane',
  'Hot thick Methane-rich', 'Hot thick Nitrogen', 'Hot thick Silicate vapour',
  'Hot thick Sulphur dioxide', 'Hot thick Water', 'Hot thick Water-rich', 'Hot thin Carbon dioxide',
  'Hot thin Metallic vapour', 'Hot thin Silicate vapour', 'Hot thin Sulphur dioxide', 'Methane',
  'Methane-rich', 'Neon-rich', 'Nitrogen', 'No atmosphere', 'Oxygen', 'Suitable for water-based life',
  'Sulphur dioxide', 'Thick Ammonia', 'Thick Ammonia and Oxygen', 'Thick Ammonia-rich',
  'Thick Argon', 'Thick Argon-rich', 'Thick Carbon dioxide', 'Thick Carbon dioxide-rich',
  'Thick Helium', 'Thick Methane', 'Thick Methane-rich', 'Thick Nitrogen', 'Thick No atmosphere',
  'Thick Suitable for water-based life', 'Thick Sulphur dioxide', 'Thick Water', 'Thick Water-rich',
  'Thin Ammonia', 'Thin Ammonia and Oxygen', 'Thin Ammonia-rich', 'Thin Argon', 'Thin Argon-rich',
  'Thin Carbon dioxide', 'Thin Carbon dioxide-rich', 'Thin Helium', 'Thin Methane', 'Thin Methane-rich',
  'Thin Neon', 'Thin Neon-rich', 'Thin Nitrogen', 'Thin Oxygen', 'Thin Sulphur dioxide', 'Thin Water',
  'Thin Water-rich', 'Water', 'Water-rich'
])

const VOLCANISM_TYPES = options([
  'Carbon Dioxide Geysers', 'Major Carbon Dioxide Geysers', 'Major Metallic Magma',
  'Major Rocky Magma', 'Major Silicate Vapour Geysers', 'Major Water Geysers', 'Major Water Magma',
  'Metallic Magma', 'Minor Ammonia Magma', 'Minor Carbon Dioxide Geysers', 'Minor Metallic Magma',
  'Minor Methane Magma', 'Minor Nitrogen Magma', 'Minor Rocky Magma', 'Minor Silicate Vapour Geysers',
  'Minor Water Geysers', 'Minor Water Magma', 'No volcanism', 'Rocky Magma',
  'Silicate Vapour Geysers', 'Water Geysers', 'Water Magma'
])

const SERVICES: GalaxyQueryFieldOption[] = [
  ['interstellar-factors', 'Interstellar factors'],
  ['material-trader', 'Material trader'],
  ['technology-broker', 'Technology broker'],
  ['black-market', 'Black market'],
  ['universal-cartographics', 'Universal Cartographics'],
  ['refuel', 'Refuel'],
  ['repair', 'Repair'],
  ['shipyard', 'Shipyard'],
  ['outfitting', 'Outfitting'],
  ['search-and-rescue', 'Search and rescue']
].map(([value, label]) => ({ label, value }))

const GALAXY_QUERY_DEFINITIONS: GalaxyQueryDefinition[] = [
  {
    defaults: { atmosphere: [], bodyType: [], landable: 'yes', lastReportedBefore: '', maxDistance: '100', maxGravityG: '', maxTemperatureK: '', minBiologicalSignals: '1', minGeologicalSignals: '0', minGravityG: '', minTemperatureK: '', origin: '', volcanism: [] },
    domain: 'Cartography',
    fields: [
      ORIGIN,
      { ...RADIUS, id: 'maxDistance' },
      { id: 'bodyType', label: 'Body subtype', options: BODY_SUBTYPES, type: 'multi-select' },
      { id: 'atmosphere', label: 'Atmosphere', options: ATMOSPHERES, type: 'multi-select' },
      { id: 'landable', label: 'Landable', options: [{ label: 'Any', value: 'any' }, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }], type: 'select' },
      { id: 'minGravityG', label: 'Minimum gravity (g)', min: 0, type: 'number' },
      { id: 'maxGravityG', label: 'Maximum gravity (g)', min: 0, type: 'number' },
      { id: 'minTemperatureK', label: 'Minimum temperature (K)', min: 0, type: 'number' },
      { id: 'maxTemperatureK', label: 'Maximum temperature (K)', min: 0, type: 'number' },
      { id: 'volcanism', label: 'Volcanism', options: VOLCANISM_TYPES, type: 'multi-select' },
      { id: 'minBiologicalSignals', label: 'Minimum biological signals', min: 0, type: 'number' },
      { id: 'minGeologicalSignals', label: 'Minimum geological signals', min: 0, type: 'number' },
      { id: 'lastReportedBefore', label: 'Last reported before', hint: 'For pre-Odyssey candidates, use 2021-05-19 and set minimum biological signals to 0.', type: 'date' }
    ],
    id: 'exploration-targets',
    purpose: 'Locate reported bodies by physical characteristics and surface signals without claiming unfinished exploration.',
    title: 'Exploration targets'
  },
  {
    defaults: { origin: '', radius: '50' },
    domain: 'Cartography',
    fields: [ORIGIN, RADIUS],
    id: 'nearby-systems',
    purpose: 'Inspect known systems around a reference system.',
    title: 'Nearby systems'
  },
  {
    defaults: { hull: '', origin: '' },
    domain: 'Facilities',
    fields: [ORIGIN, { id: 'hull', label: 'Ship hull', placeholder: 'Type-11 Prospector', required: true, type: 'text' }],
    id: 'shipyards',
    purpose: 'Locate shipyards reporting a particular hull in stock.',
    title: 'Shipyards selling a hull'
  },
  {
    defaults: { origin: '', pad: 'medium', service: 'material-trader' },
    domain: 'Facilities',
    fields: [ORIGIN, { id: 'service', label: 'Required service', options: SERVICES, required: true, type: 'select' }, PAD],
    id: 'facilities',
    purpose: 'Find the nearest station providing an operational service.',
    title: 'Nearest facility'
  },
  {
    defaults: { commodity: 'gold', intent: 'sell', maxDaysAgo: '30', maxDistance: '100', minVolume: '1', origin: '' },
    domain: 'Markets',
    fields: [
      ORIGIN,
      { id: 'commodity', label: 'Commodity', required: true, type: 'text' },
      { id: 'intent', label: 'Commander intent', options: [{ label: 'Buy cargo', value: 'buy' }, { label: 'Sell cargo', value: 'sell' }], required: true, type: 'select' },
      { id: 'maxDistance', label: 'Maximum distance (ly)', min: 1, max: 500, required: true, type: 'number' },
      { id: 'minVolume', label: 'Minimum stock or demand', min: 1, required: true, type: 'number' },
      MAX_AGE
    ],
    id: 'commodity-markets',
    purpose: 'Find markets to buy or sell a specific commodity.',
    title: 'Commodity markets'
  },
  {
    defaults: { maxDaysAgo: '30', maxDistance: '100', module: '', origin: '', pad: 'medium' },
    domain: 'Facilities',
    fields: [ORIGIN, { id: 'module', label: 'Module', placeholder: '6A Power Plant', required: true, type: 'text' }, PAD, { ...RADIUS, id: 'maxDistance' }, MAX_AGE],
    id: 'outfitting-stock',
    purpose: 'Locate stations reporting a named module in stock.',
    title: 'Outfitting stock'
  },
  {
    defaults: { name: '', origin: '', pad: 'small', radius: '100', stationType: 'any' },
    domain: 'Facilities',
    fields: [
      { id: 'name', label: 'Station name', required: true, type: 'text' },
      ORIGIN,
      RADIUS,
      { id: 'stationType', label: 'Station type', options: [{ label: 'Any', value: 'any' }, { label: 'Orbital', value: 'orbital' }, { label: 'Surface', value: 'surface' }, { label: 'Fleet carrier', value: 'carrier' }], type: 'select' },
      PAD
    ],
    id: 'station-lookup',
    purpose: 'Locate a known or partially remembered station.',
    title: 'Station lookup'
  },
  {
    defaults: { allegiance: 'any', economy: 'any', government: 'any', maxPopulation: '', minPopulation: '', origin: '', population: 'any', radius: '100', security: 'any' },
    domain: 'Cartography',
    fields: [
      ORIGIN,
      RADIUS,
      { id: 'population', label: 'Population', options: [{ label: 'Any', value: 'any' }, { label: 'Inhabited', value: 'inhabited' }, { label: 'Uninhabited', value: 'uninhabited' }], type: 'select' },
      { id: 'minPopulation', label: 'Minimum population', min: 0, type: 'number' },
      { id: 'maxPopulation', label: 'Maximum population', min: 0, type: 'number' },
      { id: 'economy', label: 'Primary economy', options: commonAnyOptions(['Agriculture', 'Colony', 'Extraction', 'High Tech', 'Industrial', 'Military', 'None', 'Refinery', 'Service', 'Terraforming', 'Tourism']), type: 'select' },
      { id: 'allegiance', label: 'Allegiance', options: commonAnyOptions(['Alliance', 'Empire', 'Federation', 'Guardian', 'Independent', 'Pilots Federation', 'Thargoid']), type: 'select' },
      { id: 'government', label: 'Government', options: commonAnyOptions(['Anarchy', 'Communism', 'Confederacy', 'Cooperative', 'Corporate', 'Democracy', 'Dictatorship', 'Feudal', 'None', 'Patronage', 'Prison', 'Prison Colony', 'Theocracy']), type: 'select' },
      { id: 'security', label: 'Security', options: commonAnyOptions(['Anarchy', 'Low', 'Medium', 'High']), type: 'select' },
    ],
    id: 'filtered-systems',
    purpose: 'Find systems matching demographic, economic, and political characteristics.',
    title: 'Filtered system search'
  },
  {
    defaults: { allegiance: 'any', controlling: 'any', faction: '', government: 'any', maxDistance: '100', minInfluence: '0', origin: '', state: 'any' },
    domain: 'Politics',
    fields: [
      { id: 'faction', label: 'Faction', required: true, type: 'text' },
      ORIGIN,
      { ...RADIUS, id: 'maxDistance' },
      { id: 'state', label: 'State', options: commonAnyOptions(['Boom', 'Bust', 'Civil Unrest', 'Expansion', 'Famine', 'War']), type: 'select' },
      { id: 'allegiance', label: 'Allegiance', options: commonAnyOptions(['Alliance', 'Empire', 'Federation', 'Independent']), type: 'select' },
      { id: 'government', label: 'Government', options: commonAnyOptions(['Anarchy', 'Communism', 'Confederacy', 'Cooperative', 'Corporate', 'Democracy', 'Dictatorship', 'Feudal', 'Patronage', 'Prison Colony', 'Theocracy']), type: 'select' },
      { id: 'controlling', label: 'Controls system', options: [{ label: 'Any', value: 'any' }, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }], type: 'select' },
      { id: 'minInfluence', label: 'Minimum influence (%)', min: 0, max: 100, type: 'number' }
    ],
    id: 'faction-presence',
    purpose: 'Locate faction presence and matching BGS conditions.',
    title: 'Faction and BGS presence'
  },
  {
    defaults: { availableCredits: '10000000', cargoCapacity: '100', maxDaysAgo: '3', maxDistance: '100', minVolume: '100', origin: '' },
    domain: 'Markets',
    fields: [
      ORIGIN,
      { id: 'cargoCapacity', label: 'Cargo capacity (t)', min: 1, required: true, type: 'number' },
      { id: 'availableCredits', label: 'Available credits', min: 1, required: true, type: 'number' },
      { id: 'maxDistance', label: 'Maximum travel distance (ly)', min: 1, max: 500, required: true, type: 'number' },
      { id: 'minVolume', label: 'Minimum supply and demand', min: 1, required: true, type: 'number' },
      MAX_AGE
    ],
    id: 'trade-opportunities',
    purpose: 'Compare reported buy and sell markets for profitable cargo movement.',
    title: 'Trade opportunities'
  }
]

const GALAXY_QUERY_ORDER: GalaxyQueryId[] = [
  'nearby-systems',
  'filtered-systems',
  'exploration-targets',
  'facilities',
  'station-lookup',
  'shipyards',
  'outfitting-stock',
  'commodity-markets',
  'trade-opportunities',
  'faction-presence'
]

export const GALAXY_QUERY_CATALOGUE: GalaxyQueryDefinition[] = GALAXY_QUERY_ORDER.map(id => {
  const definition = GALAXY_QUERY_DEFINITIONS.find(candidate => candidate.id === id)
  if (!definition) throw new Error(`Missing Galaxy query definition: ${id}`)
  return definition
})

export function galaxyQueryDefinition (id: GalaxyQueryId): GalaxyQueryDefinition {
  const definition = GALAXY_QUERY_CATALOGUE.find(candidate => candidate.id === id)
  if (!definition) throw new Error(`Unknown Galaxy query: ${id}`)
  return definition
}

function commonAnyOptions (values: string[]): GalaxyQueryFieldOption[] {
  return [{ label: 'Any', value: 'any' }, ...values.map(value => ({ label: value, value }))]
}

function options (values: string[]): GalaxyQueryFieldOption[] {
  return values.map(value => ({ label: value, value }))
}
