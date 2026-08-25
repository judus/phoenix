import { COMMANDER_RANK_NAMES, type RuntimeState, type ShipModule } from '@phoenix/contracts'

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

const RANK_LABELS: Record<keyof typeof COMMANDER_RANK_NAMES, string> = {
  combat: 'Combat',
  trade: 'Trade',
  exploration: 'Exploration',
  federation: 'Federation',
  empire: 'Empire',
  cqc: 'CQC',
  mercenary: 'Mercenary',
  exobiologist: 'Exobiology'
}

const LIVE_FLAGS = [
  'beingInterdicted', 'cargoScoopDeployed', 'docked', 'flightAssistOff', 'fsdCharging',
  'fsdCooldown', 'fsdJump', 'fsdMassLocked', 'hardpointsDeployed', 'inDanger', 'inFighter',
  'inMainShip', 'inSrv', 'landed', 'landingGearDown', 'lightsOn', 'lowFuel', 'nightVision',
  'overheating', 'scoopingFuel', 'shieldsUp', 'silentRunning', 'supercruise'
] as const

export interface RuntimeContextSupplement {
  render(): string
}

export class RuntimeContextRenderer {
  public constructor (private readonly supplements: readonly RuntimeContextSupplement[] = []) {}

  public render (state: RuntimeState): string {
    const sections = [
      '## Runtime Context',
      '',
      '_Authoritative local telemetry. Current but possibly stale; do not recite unless asked._',
      '',
      `Updated: ${state.updatedAt ?? 'unknown'} · Revision: ${state.revision}`
    ]

    addSection(sections, 'Commander', commanderLines(state))
    addSection(sections, 'Current System', systemLines(state))
    addSection(sections, 'Current Location', locationLines(state))
    addSection(sections, 'Current Ship', shipLines(state))
    addSection(sections, 'Current Status', statusLines(state))
    addOutfitting(sections, state.ship.modules)
    for (const supplement of this.supplements) {
      const rendered = supplement.render().trim()
      if (rendered) sections.push('', rendered)
    }
    return sections.join('\n')
  }
}

function commanderLines (state: RuntimeState): string[] {
  const lines: string[] = []
  addLine(lines, 'Name', state.commander.name)
  addLine(lines, 'Credits', state.gameStatus?.balance === null ? null : credits(state.gameStatus?.balance))
  addLine(lines, 'Career ranks', rankText(state, ['combat', 'trade', 'exploration', 'mercenary', 'exobiologist']))
  addLine(lines, 'Superpower / CQC ranks', rankText(state, ['federation', 'empire', 'cqc']))
  return lines
}

function rankText (state: RuntimeState, keys: Array<keyof typeof COMMANDER_RANK_NAMES>): string | null {
  const ranks = keys.flatMap(key => {
    const level = state.commander.ranks[key]
    if (level === null) return []
    const title = COMMANDER_RANK_NAMES[key][level] ?? `Rank ${level}`
    const progress = state.commander.rankProgress[key]
    return [`${RANK_LABELS[key]} ${title}${progress === null ? '' : ` (${progress}%)`}`]
  })
  return ranks.length > 0 ? ranks.join(' · ') : null
}

function systemLines (state: RuntimeState): string[] {
  const system = state.system
  const lines: string[] = []
  addLine(lines, 'Name', system.name)
  addLine(lines, 'Economy', join(system.primaryEconomy?.label, system.secondaryEconomy?.label))
  addLine(lines, 'Population', system.population === null ? null : number.format(system.population))
  addLine(lines, 'Allegiance', system.allegiance)
  addLine(lines, 'Government', system.government?.label)
  addLine(lines, 'Security', system.security?.label)
  addLine(lines, 'Controlling faction', factionText(system.controllingFaction))
  if (system.powerplay) {
    addLine(lines, 'Powerplay', join(system.powerplay.controllingPower, system.powerplay.state))
  }
  return lines
}

function locationLines (state: RuntimeState): string[] {
  const lines: string[] = []
  addLine(lines, 'State', humanize(state.location.state))
  const place = state.location.place
  if (place?.kind === 'station') {
    addLine(lines, 'Station', join(place.name, place.type))
    addLine(lines, 'Services', place.services.length > 0 ? place.services.map(humanize).join(', ') : null)
  } else if (place?.kind === 'body') {
    addLine(lines, 'Body', join(place.name, place.type))
  }
  return lines
}

function shipLines (state: RuntimeState): string[] {
  const ship = state.ship
  const status = state.gameStatus
  const lines: string[] = []
  addLine(lines, 'Hull', join(
    ship.definition?.displayName ?? ship.typeId,
    ship.definition?.manufacturer,
    ship.definition?.landingPadSize ? `${humanize(ship.definition.landingPadSize)} landing pad` : null
  ))
  addLine(lines, 'Name', ship.name)
  addLine(lines, 'Registration', ship.identifier)
  addLine(lines, 'Hull integrity', ship.hullHealth === null ? null : `${number.format(ship.hullHealth * 100)}%`)
  addLine(lines, 'Performance', join(
    ship.maxJumpRange === null ? null : `${number.format(ship.maxJumpRange)} Ly jump range`,
    ship.unladenMass === null ? null : `${number.format(ship.unladenMass)} T unladen`,
    ship.rebuy === null ? null : `${credits(ship.rebuy)} rebuy`
  ))
  addLine(lines, 'Fuel', fuelText(state))
  addLine(lines, 'Cargo', cargoText(state))
  addLine(lines, 'Selected weapon', status?.selectedWeapon)
  return lines
}

function statusLines (state: RuntimeState): string[] {
  const status = state.gameStatus
  if (!status) return []
  const lines: string[] = []
  addLine(lines, 'Legal state', status.legalState)
  const active = LIVE_FLAGS.filter(flag => status.flags[flag]).map(humanize)
  const activeFoot = Object.entries(status.flags2).filter(([, enabled]) => enabled).map(([flag]) => humanize(flag))
  addLine(lines, 'Active flags', [...active, ...activeFoot].join(', '))
  addLine(lines, 'Power distribution', status.pips
    ? `SYS ${status.pips.systems} · ENG ${status.pips.engines} · WEP ${status.pips.weapons}`
    : null)
  addLine(lines, 'Destination', status.destination?.name)
  return lines
}

function fuelText (state: RuntimeState): string | null {
  const current = state.gameStatus?.fuel
  const capacity = state.ship.fuelCapacity
  if (!current && !capacity) return null
  const main = current && capacity
    ? `${number.format(current.main)}/${number.format(capacity.main)} T main`
    : current
      ? `${number.format(current.main)} T main`
      : `${number.format(capacity?.main ?? 0)} T main capacity`
  const reservoir = current?.reservoir ?? capacity?.reserve
  return `${main}${reservoir === undefined ? '' : ` · ${number.format(reservoir)} T reservoir`}`
}

function cargoText (state: RuntimeState): string | null {
  const inventory = state.inventory.cargo
  const used = state.gameStatus?.cargo ?? inventory?.items.reduce((sum, item) => sum + item.count, 0)
  const capacity = state.ship.cargoCapacity
  const summary = used === null || used === undefined
    ? capacity === null ? null : `${number.format(capacity)} T capacity`
    : capacity === null ? `${number.format(used)} T` : `${number.format(used)}/${number.format(capacity)} T`
  const contents = inventory?.items.filter(item => item.count > 0).slice(0, 5)
    .map(item => `${item.count} ${item.label ?? item.id}`)
  return join(summary, contents && contents.length > 0 ? contents.join(', ') : null)
}

function addOutfitting (sections: string[], modules: readonly ShipModule[]): void {
  if (modules.length === 0) return
  sections.push('', '### Current Outfitting')
  const groups: Array<[ShipModule['slotGroup'], string]> = [
    ['hardpoint', 'Hardpoints'],
    ['utility', 'Utility Mounts'],
    ['core', 'Core Internals'],
    ['optional', 'Optional Internals'],
    ['ship', 'Ship Modules'],
    ['other', 'Other Modules']
  ]
  for (const [group, heading] of groups) {
    const entries = modules.filter(module => module.slotGroup === group)
    if (entries.length === 0) continue
    sections.push('', `#### ${heading}`)
    for (const module of entries) sections.push(`- ${moduleText(module)}`)
  }
}

function moduleText (module: ShipModule): string {
  const slot = module.expectedSlot?.name ?? module.slotId
  const slotSize = module.slotSize === null ? '' : ` · Size ${module.slotSize}`
  const rating = module.definition?.rating
  const moduleSize = module.moduleSize ?? module.definition?.size
  const grade = moduleSize === null || moduleSize === undefined || !rating ? null : `${moduleSize}${rating}`
  const name = join(grade, module.definition?.displayName ?? module.moduleId) ?? module.moduleId
  const details = [
    module.enabled === false ? 'off' : null,
    module.health !== null && module.health < 1 ? `${number.format(module.health * 100)}% health` : null,
    engineeringText(module)
  ].filter((value): value is string => Boolean(value))
  return `${slot}${slotSize}: ${name}${details.length > 0 ? `; ${details.join('; ')}` : ''}`
}

function engineeringText (module: ShipModule): string {
  const engineering = module.engineering
  if (!engineering) return 'engineered: no'
  const blueprint = engineering.blueprintName ?? `blueprint ${engineering.blueprintId ?? 'unknown'}`
  return `engineered: ${blueprint}${engineering.level === null ? '' : ` G${engineering.level}`}${engineering.experimentalEffectLabel ? ` / ${engineering.experimentalEffectLabel}` : ''}`
}

function factionText (faction: RuntimeState['system']['controllingFaction']): string | null {
  if (!faction) return null
  return join(faction.name, faction.state, faction.influence === null ? null : `${number.format(faction.influence * 100)}% influence`)
}

function addSection (sections: string[], heading: string, lines: string[]): void {
  if (lines.length === 0) return
  sections.push('', `### ${heading}`, ...lines.map(line => `- ${line}`))
}

function addLine (lines: string[], label: string, value: string | null | undefined): void {
  if (value) lines.push(`${label}: ${value}`)
}

function join (...values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value))
  return present.length > 0 ? present.join(' · ') : null
}

function humanize (value: string): string {
  return value.replace(/_/gu, ' ').replace(/([a-z])([A-Z])/gu, '$1 $2').replace(/^./u, first => first.toUpperCase())
}

function credits (value: number | undefined): string | null {
  return value === undefined ? null : `${number.format(value)} CR`
}
