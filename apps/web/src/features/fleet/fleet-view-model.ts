import type {
  FleetResponse,
  FleetShip,
  RuntimeState,
  ShipDefinition,
  ShipModule,
  ShipSlotDefinition,
  StoredModule
} from '@phoenix/contracts'

const moduleGroups: Array<{
  definitionKey: keyof ShipDefinition['slots']
  id: 'core' | 'optional' | 'hardpoint' | 'utility'
  label: string
}> = [
  { definitionKey: 'core', id: 'core', label: 'Core internals' },
  { definitionKey: 'optional', id: 'optional', label: 'Optional internals' },
  { definitionKey: 'hardpoints', id: 'hardpoint', label: 'Hardpoints' },
  { definitionKey: 'utilities', id: 'utility', label: 'Utility mounts' }
]

export interface CurrentShipModel {
  title: string
  vessel: Array<{ label: string, value: string }>
  operation: Array<{ label: string, value: string }>
  integrity: Array<{ label: string, value: number, valueLabel: string }>
  fuel: Array<{ label: string, value: number, valueLabel: string }>
  cargo: { count: number, capacity: number | null, items: Array<{ id: string, label: string, count: number, detail: string }> }
  controls: Array<{ actionId: string, label: string, active: boolean }>
  modules: Array<{
    capacity: number
    id: string
    label: string
    mounted: number
    items: Array<{
      id: string
      slot: string
      slotDetail: string
      module: string
      moduleDetail: string
      engineering: string
      engineeringDetail: string
      engineeringBlueprint: string | null
      engineeringGrade: number | null
      engineeringEngineer: string | null
      engineeringExperimentalEffect: string | null
      condition: string
      empty?: boolean
      state: string
      status?: 'broken' | 'disabled'
    }>
  }>
}

export interface FleetOverviewModel {
  summary: Array<{ label: string, value: number }>
  ships: Array<{
    id: number
    name: string
    detail: string
    state: string
    location: string
    value: string
    transfer: string
    observed: string
    active: boolean
  }>
  assets: Array<{ label: string, value: number, detail: string }>
}

export interface StoredModulesModel {
  groups: Array<{
    system: string
    items: Array<{
      key: string
      name: string
      identifier: string
      engineering: string
      slot: number
      transfer: string
      value: string
      observed: string
    }>
  }>
  authority: string
  details: string
}

export function createCurrentShipModel(state: RuntimeState, locale = 'en-CH'): CurrentShipModel {
  const { ship, gameStatus } = state
  const cargoItems = state.inventory.cargo?.items ?? []
  const cargoCount = cargoItems.reduce((total, item) => total + item.count, 0)
  const fuelMain = percentage(gameStatus?.fuel?.main, ship.fuelCapacity?.main)
  const fuelReserve = percentage(gameStatus?.fuel?.reservoir, ship.fuelCapacity?.reserve)
  const hull = ship.hullHealth === null ? 0 : ship.hullHealth * 100
  const flags = gameStatus?.flags

  return {
    title: ship.name ?? ship.definition?.displayName ?? ship.typeId ?? 'Current ship',
    vessel: [
      fact('Name', ship.name),
      fact('Identifier', ship.identifier),
      fact('Model', ship.definition?.displayName ?? ship.typeId),
      fact('Manufacturer', ship.definition?.manufacturer),
      fact('Landing pad', ship.definition?.landingPadSize),
      fact('Hull value', credits(ship.hullValue, locale))
    ],
    operation: [
      fact('Unladen mass', unit(ship.unladenMass, 't', locale, 1)),
      fact('Jump range', unit(ship.maxJumpRange, 'ly', locale, 1)),
      fact('Modules value', credits(ship.modulesValue, locale)),
      fact('Rebuy cost', credits(ship.rebuy, locale)),
      fact('Modules', String(ship.modules.length)),
      fact('Legal state', gameStatus?.legalState)
    ],
    integrity: [
      { label: 'Hull', value: hull, valueLabel: ship.hullHealth === null ? 'Not reported' : `${Math.round(hull)}%` },
      { label: 'Shields', value: flags?.shieldsUp ? 100 : 0, valueLabel: flags ? (flags.shieldsUp ? 'Up' : 'Down') : 'Not reported' }
    ],
    fuel: [
      { label: 'Main fuel', value: fuelMain.value, valueLabel: fuelMain.label },
      { label: 'Reservoir', value: fuelReserve.value, valueLabel: fuelReserve.label }
    ],
    cargo: {
      count: cargoCount,
      capacity: ship.cargoCapacity,
      items: cargoItems.map(item => ({
        id: `${item.id}:${item.missionId ?? 'general'}`,
        label: item.label ?? item.id,
        count: item.count,
        detail: item.missionId !== null ? `Mission ${item.missionId}` : item.stolen > 0 ? `${item.stolen} stolen` : item.id
      }))
    },
    controls: [
      { actionId: 'elite.DeployHardpointToggle', label: 'Hardpoints', active: flags?.hardpointsDeployed ?? false },
      { actionId: 'elite.LandingGearToggle', label: 'Landing gear', active: flags?.landingGearDown ?? false },
      { actionId: 'elite.ToggleCargoScoop', label: 'Cargo scoop', active: flags?.cargoScoopDeployed ?? false },
      { actionId: 'elite.ShipSpotLightToggle', label: 'Lights', active: flags?.lightsOn ?? false },
      { actionId: 'elite.NightVisionToggle', label: 'Night vision', active: flags?.nightVision ?? false },
      { actionId: 'elite.ToggleFlightAssist', label: 'Flight assist', active: flags ? !flags.flightAssistOff : false }
    ],
    modules: moduleGroups.map(group => moduleGroupModel(ship, group)).filter(group => group.capacity > 0)
  }
}

export function createFleetOverviewModel(fleet: FleetResponse, locale = 'en-CH'): FleetOverviewModel {
  return {
    summary: [
      { label: 'Active', value: fleet.summary.active },
      { label: 'Owned', value: fleet.summary.owned },
      { label: 'Stored', value: fleet.summary.stored },
      { label: 'Transferring', value: fleet.summary.transferring },
      { label: 'Unknown', value: fleet.summary.unknown }
    ],
    ships: fleet.ships.map(ship => fleetShipModel(ship, fleet.activeShipId, locale)),
    assets: [
      {
        label: 'Stored equipment',
        value: fleet.storedModules.items.length,
        detail: fleet.storedModules.snapshotAt ? `${title(fleet.storedModules.details)} snapshot` : 'No snapshot observed'
      },
      {
        label: 'Fleet carriers',
        value: fleet.carriers.items.length,
        detail: fleet.carriers.observed ? 'Observed locally' : 'No authoritative record observed'
      }
    ]
  }
}

export function createStoredModulesModel(fleet: FleetResponse, locale = 'en-CH'): StoredModulesModel {
  const groups = new Map<string, StoredModule[]>()
  for (const module of fleet.storedModules.items) {
    const system = module.system || 'Unknown system'
    groups.set(system, [...(groups.get(system) ?? []), module])
  }
  return {
    groups: [...groups].map(([system, modules]) => ({
      system,
      items: modules.map(module => ({
        key: `${module.marketId}:${module.storageSlot}`,
        name: module.displayName ?? module.rawName,
        identifier: `${module.rawName}${module.hot ? ' · Hot' : ''}`,
        engineering: module.engineering
          ? `${module.engineering.blueprint}${module.engineering.level === null ? '' : ` G${module.engineering.level}`}`
          : '—',
        slot: module.storageSlot,
        transfer: `${duration(module.transferSeconds)} · ${credits(module.transferCost, locale)}`,
        value: credits(module.buyPrice, locale),
        observed: dateTime(module.updatedAt, locale)
      }))
    })),
    details: `${title(fleet.storedModules.details)} snapshot`,
    authority: storedModuleAuthority(fleet, locale)
  }
}

function fleetShipModel(ship: FleetShip, activeShipId: number | null, locale: string) {
  return {
    id: ship.id,
    name: ship.name ?? ship.displayName ?? ship.typeId ?? `Ship ${ship.id}`,
    detail: [ship.displayName, ship.identifier].filter(Boolean).join(' · ') || `Ship ID ${ship.id}`,
    state: `${title(ship.state.replaceAll('-', ' '))}${ship.hot ? ' · Hot' : ''}`,
    location: [ship.station, ship.system].filter(Boolean).join(' · ') || '—',
    value: credits(ship.value, locale),
    transfer: ship.state === 'transfer' ? `${duration(ship.transferSeconds)} · ${credits(ship.transferPrice, locale)}` : '—',
    observed: dateTime(ship.updatedAt, locale),
    active: ship.id === activeShipId || ship.state === 'active'
  }
}

function moduleGroupModel(
  ship: RuntimeState['ship'],
  group: typeof moduleGroups[number]
): CurrentShipModel['modules'][number] {
  const observed = ship.modules.filter(module => module.slotGroup === group.id)
  const expected = ship.definition?.slots[group.definitionKey] ?? []
  if (expected.length === 0) {
    const items = observed.map(module => moduleModel(module))
    return { id: group.id, label: group.label, mounted: items.length, capacity: items.length, items }
  }

  const used = new Set<ShipModule>()
  const items = expected.map((slot, index) => {
    const module = observed.find(candidate => !used.has(candidate) && sameSlot(candidate.expectedSlot, slot))
    if (module) {
      used.add(module)
      return moduleModel(module, slotLabel(group.id, slot, index), slotType(group.id, slot))
    }
    return emptyModule(group.id, slot, index)
  })
  const unmatched = observed.filter(module => !used.has(module))
  const leading = group.id === 'core' ? unmatched.filter(module => module.slotId === 'Armour') : []
  const trailing = unmatched.filter(module => !leading.includes(module))
  const complete = [...leading.map(module => moduleModel(module)), ...items, ...trailing.map(module => moduleModel(module))]
  return { id: group.id, label: group.label, mounted: observed.length, capacity: complete.length, items: complete }
}

function moduleModel(
  module: ShipModule,
  slot = module.expectedSlot?.name ?? module.slotId,
  type = slotType(module.slotGroup, module.expectedSlot ?? { size: module.slotSize ?? 0 })
): CurrentShipModel['modules'][number]['items'][number] {
  const health = module.health === null ? null : Math.round(module.health * 100)
  const engineering = module.engineering
  const displayName = module.definition?.displayName
  const moduleClass = [module.moduleSize ?? module.definition?.size, module.definition?.rating]
    .filter(value => value !== null && value !== undefined).join('')
  return {
    id: module.slotId,
    slot,
    slotDetail: `Size ${module.slotSize ?? module.expectedSlot?.size ?? '—'}`,
    module: displayName ? `${moduleClass ? `${moduleClass} ` : ''}${displayName}` : module.moduleId,
    moduleDetail: type,
    engineering: engineering ? `${engineering.blueprintName ?? 'Engineered'}${engineering.level ? ` G${engineering.level}` : ''}` : 'Standard',
    engineeringDetail: engineering?.experimentalEffectLabel ?? engineering?.experimentalEffect ?? engineering?.engineer ?? 'Configuration',
    engineeringBlueprint: engineering?.blueprintName ?? null,
    engineeringGrade: engineering?.level ?? null,
    engineeringEngineer: engineering?.engineer ?? null,
    engineeringExperimentalEffect: engineering?.experimentalEffectLabel ?? engineering?.experimentalEffect ?? null,
    condition: health === null ? '—' : `${health}%`,
    state: module.enabled === false ? 'Disabled' : module.enabled === true ? `Enabled · P${module.priority ?? '—'}` : `Priority ${module.priority ?? '—'}`,
    ...(health !== null && health <= 0 ? { status: 'broken' as const } : module.enabled === false ? { status: 'disabled' as const } : {})
  }
}

function emptyModule(
  group: typeof moduleGroups[number]['id'],
  slot: ShipSlotDefinition,
  index: number
): CurrentShipModel['modules'][number]['items'][number] {
  return {
    id: `empty:${group}:${index}`,
    slot: slotLabel(group, slot, index),
    slotDetail: `Size ${slot.size}`,
    module: 'Empty slot',
    moduleDetail: slotType(group, slot),
    engineering: 'Standard',
    engineeringDetail: 'Configuration',
    engineeringBlueprint: null,
    engineeringGrade: null,
    engineeringEngineer: null,
    engineeringExperimentalEffect: null,
    condition: '—',
    empty: true,
    state: 'Available'
  }
}

function sameSlot(left: ShipSlotDefinition | null, right: ShipSlotDefinition): boolean {
  return left !== null && left.size === right.size && (left.name ?? null) === (right.name ?? null)
}

function slotLabel(group: typeof moduleGroups[number]['id'], slot: ShipSlotDefinition, index: number): string {
  if (group === 'core') return slot.name ?? `Core ${padSlot(index)}`
  if (group === 'optional') return `Optional ${padSlot(index)}`
  if (group === 'hardpoint') return `Hardpoint ${padSlot(index)}`
  return `Utility ${padSlot(index)}`
}

function slotType(group: ShipModule['slotGroup'], slot: ShipSlotDefinition): string {
  if (group === 'core') return 'Core internal'
  if (group === 'optional') return slot.name ?? 'Optional internal'
  if (group === 'hardpoint') return `${hardpointSize(slot.size)} hardpoint`
  if (group === 'utility') return 'Utility mount'
  return title(group)
}

function hardpointSize(size: number): string {
  return ['Utility', 'Small', 'Medium', 'Large', 'Huge'][size] ?? `Size ${size}`
}

function padSlot(index: number): string {
  return String(index + 1).padStart(2, '0')
}

function fact(label: string, value: string | null | undefined) {
  return { label, value: value?.trim() || '—' }
}

function percentage(value: number | null | undefined, maximum: number | null | undefined) {
  if (value === null || value === undefined || maximum === null || maximum === undefined || maximum <= 0) {
    return { value: 0, label: 'Not reported' }
  }
  const percent = Math.max(0, Math.min(100, value / maximum * 100))
  return { value: percent, label: `${value.toFixed(1)} / ${maximum.toFixed(1)} t` }
}

function credits(value: number | null | undefined, locale: string): string {
  return value === null || value === undefined ? '—' : `${new Intl.NumberFormat(locale).format(value)} CR`
}

function unit(value: number | null | undefined, suffix: string, locale: string, digits = 0): string {
  return value === null || value === undefined
    ? '—'
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${suffix}`
}

function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return seconds % 60 === 0 ? `${minutes}m` : `${minutes}m ${seconds % 60}s`
}

function dateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function storedModuleAuthority(fleet: FleetResponse, locale: string): string {
  const snapshot = fleet.storedModules.snapshotAt ? `Snapshot ${dateTime(fleet.storedModules.snapshotAt, locale)}` : 'No snapshot observed'
  return fleet.storedModules.latestMutationAt
    ? `${snapshot} · Latest storage change ${dateTime(fleet.storedModules.latestMutationAt, locale)}`
    : snapshot
}

function title(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`
}
