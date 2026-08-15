export type GalaxyQueryId =
  | 'commodity-markets'
  | 'facilities'
  | 'faction-presence'
  | 'filtered-systems'
  | 'nearby-systems'
  | 'outfitting-stock'
  | 'shipyards'
  | 'station-lookup'
  | 'trade-opportunities'

export interface GalaxyQueryFieldOption {
  label: string
  value: string
}

export interface GalaxyQueryField {
  id: string
  label: string
  max?: number
  min?: number
  options?: GalaxyQueryFieldOption[]
  placeholder?: string
  required?: boolean
  type: 'number' | 'select' | 'text'
}

export interface GalaxyQueryDefinition {
  defaults: Record<string, string>
  domain: 'Cartography' | 'Facilities' | 'Markets' | 'Politics'
  fields: GalaxyQueryField[]
  id: GalaxyQueryId
  priority: 0 | 1 | 2
  purpose: string
  status: 'available' | 'planned'
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

export const GALAXY_QUERY_CATALOGUE: GalaxyQueryDefinition[] = [
  {
    defaults: { origin: '', radius: '50' },
    domain: 'Cartography',
    fields: [ORIGIN, RADIUS],
    id: 'nearby-systems',
    priority: 0,
    purpose: 'Inspect known systems around a reference system.',
    status: 'available',
    title: 'Nearby systems'
  },
  {
    defaults: { hull: '', origin: '' },
    domain: 'Facilities',
    fields: [ORIGIN, { id: 'hull', label: 'Ship hull', placeholder: 'Type-11 Prospector', required: true, type: 'text' }],
    id: 'shipyards',
    priority: 0,
    purpose: 'Locate shipyards reporting a particular hull in stock.',
    status: 'available',
    title: 'Shipyards selling a hull'
  },
  {
    defaults: { origin: '', pad: 'medium', service: 'material-trader' },
    domain: 'Facilities',
    fields: [ORIGIN, { id: 'service', label: 'Required service', options: SERVICES, required: true, type: 'select' }, PAD],
    id: 'facilities',
    priority: 0,
    purpose: 'Find the nearest station providing an operational service.',
    status: 'available',
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
    priority: 0,
    purpose: 'Find markets to buy or sell a specific commodity.',
    status: 'available',
    title: 'Commodity markets'
  },
  {
    defaults: { maxDaysAgo: '30', maxDistance: '100', module: '', origin: '', pad: 'medium' },
    domain: 'Facilities',
    fields: [ORIGIN, { id: 'module', label: 'Module', placeholder: '6A Power Plant', required: true, type: 'text' }, PAD, { ...RADIUS, id: 'maxDistance' }, MAX_AGE],
    id: 'outfitting-stock',
    priority: 1,
    purpose: 'Locate stations reporting a named module in stock.',
    status: 'available',
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
    priority: 1,
    purpose: 'Locate a known or partially remembered station.',
    status: 'available',
    title: 'Station lookup'
  },
  {
    defaults: { allegiance: 'any', economy: 'any', inhabited: 'either', origin: '', radius: '100', security: 'any', starClass: 'any' },
    domain: 'Cartography',
    fields: [
      ORIGIN,
      RADIUS,
      { id: 'inhabited', label: 'Population', options: [{ label: 'Any', value: 'either' }, { label: 'Inhabited', value: 'yes' }, { label: 'Uninhabited', value: 'no' }], type: 'select' },
      { id: 'economy', label: 'Economy', options: commonAnyOptions(['Agriculture', 'Extraction', 'High Tech', 'Industrial', 'Refinery', 'Tourism']), type: 'select' },
      { id: 'allegiance', label: 'Allegiance', options: commonAnyOptions(['Alliance', 'Empire', 'Federation', 'Independent']), type: 'select' },
      { id: 'security', label: 'Security', options: commonAnyOptions(['Anarchy', 'Low', 'Medium', 'High']), type: 'select' },
      { id: 'starClass', label: 'Primary star class', options: commonAnyOptions(['O', 'B', 'A', 'F', 'G', 'K', 'M', 'Neutron', 'Black hole']), type: 'select' }
    ],
    id: 'filtered-systems',
    priority: 1,
    purpose: 'Find systems matching operational and stellar characteristics.',
    status: 'planned',
    title: 'Filtered system search'
  },
  {
    defaults: { allegiance: 'any', faction: '', maxDistance: '100', minInfluence: '0', origin: '', state: 'any' },
    domain: 'Politics',
    fields: [
      { id: 'faction', label: 'Faction', required: true, type: 'text' },
      ORIGIN,
      { ...RADIUS, id: 'maxDistance' },
      { id: 'state', label: 'State', options: commonAnyOptions(['Boom', 'Bust', 'Civil unrest', 'Expansion', 'Famine', 'War']), type: 'select' },
      { id: 'allegiance', label: 'Allegiance', options: commonAnyOptions(['Alliance', 'Empire', 'Federation', 'Independent']), type: 'select' },
      { id: 'minInfluence', label: 'Minimum influence (%)', min: 0, max: 100, type: 'number' }
    ],
    id: 'faction-presence',
    priority: 2,
    purpose: 'Locate faction presence and matching BGS conditions.',
    status: 'planned',
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
    priority: 2,
    purpose: 'Compare reported buy and sell markets for profitable cargo movement.',
    status: 'planned',
    title: 'Trade opportunities'
  }
]

export function galaxyQueryDefinition (id: GalaxyQueryId): GalaxyQueryDefinition {
  const definition = GALAXY_QUERY_CATALOGUE.find(candidate => candidate.id === id)
  if (!definition) throw new Error(`Unknown Galaxy query: ${id}`)
  return definition
}

function commonAnyOptions (values: string[]): GalaxyQueryFieldOption[] {
  return [{ label: 'Any', value: 'any' }, ...values.map(value => ({ label: value, value: value.toLowerCase() }))]
}
