import {
  CommanderEquipmentResponseSchema,
  type CommanderEquipmentResponse,
  type CommanderEquipmentUpgradeResource
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type {
  CommanderEquipmentCatalogue,
  CommanderEquipmentReader,
  CommanderEquipmentRepository,
  CommanderEquipmentUpgradeRecord,
  CommanderSuitLoadoutRecord,
  CommanderSuitRecord,
  CommanderWeaponRecord
} from '../domain/commander-equipment.js'

const CURRENT_LOADOUT = 'current-loadout'

export class CommanderEquipmentService implements CommanderEquipmentReader {
  public constructor (
    private readonly repository: CommanderEquipmentRepository,
    private readonly catalogue: CommanderEquipmentCatalogue
  ) {}

  public ingest (event: EliteJournalEvent): void {
    switch (event.event) {
      case 'BuySuit': this.ingestSuit(event, { purchase: true }); break
      case 'SellSuit': this.ingestSuit(event, { state: 'sold' }); break
      case 'UpgradeSuit': this.ingestSuit(event, { upgrade: true }); break
      case 'BuyWeapon': this.ingestWeapon(event, { purchase: true }); break
      case 'SellWeapon': this.ingestWeapon(event, { state: 'sold' }); break
      case 'UpgradeWeapon': this.ingestWeapon(event, { upgrade: true }); break
      case 'CreateSuitLoadout': this.ingestLoadoutSnapshot(event, false); break
      case 'SuitLoadout':
      case 'SwitchSuitLoadout': this.ingestLoadoutSnapshot(event, true); break
      case 'DeleteSuitLoadout': this.deleteLoadout(event); break
      case 'RenameSuitLoadout': this.renameLoadout(event); break
      case 'LoadoutEquipModule': this.equipLoadoutModule(event); break
      case 'LoadoutRemoveModule': this.removeLoadoutModule(event); break
    }
  }

  public getEquipment (): CommanderEquipmentResponse {
    const loadouts = this.repository.listLoadouts().filter(loadout => loadout.state === 'observed')
    const currentState = this.repository.getProjectionState(CURRENT_LOADOUT)
    const requestedCurrentId = integer(currentState?.value)
    const currentLoadoutId = loadouts.some(loadout => loadout.id === requestedCurrentId) ? requestedCurrentId : null
    loadouts.sort((left, right) => (
      Number(right.id === currentLoadoutId) - Number(left.id === currentLoadoutId) ||
      left.name.localeCompare(right.name) || left.id - right.id
    ))

    const loadoutIdsBySuit = associations(loadouts.map(loadout => [loadout.suitId, loadout.id]))
    const loadoutIdsByWeapon = associations(loadouts.flatMap(loadout => (
      loadout.slots.map(slot => [slot.weaponId, loadout.id] as const)
    )))
    const suits = this.repository.listSuits()
      .filter(suit => suit.state === 'observed')
      .map(suit => {
        const definition = this.catalogue.resolveSuit(suit.symbol, suit.localizedName)
        return {
          id: suit.id,
          symbol: suit.symbol,
          displayName: definition.displayName,
          grade: suit.grade,
          modifications: this.resolveModifications(suit.modificationSymbols),
          purchasePrice: suit.purchasePrice,
          purchasedAt: suit.purchasedAt,
          lastUpgrade: this.resolveUpgrade(suit.lastUpgrade),
          loadoutIds: loadoutIdsBySuit.get(suit.id) ?? [],
          updatedAt: suit.updatedAt
        }
      })
      .sort(compareEquipment)
    const weapons = this.repository.listWeapons()
      .filter(weapon => weapon.state === 'observed')
      .map(weapon => {
        const definition = this.catalogue.resolveWeapon(weapon.symbol, weapon.localizedName)
        return {
          id: weapon.id,
          symbol: weapon.symbol,
          displayName: definition.displayName,
          manufacturer: definition.manufacturer,
          category: definition.category,
          damageType: definition.damageType,
          grade: weapon.grade,
          modifications: this.resolveModifications(weapon.modificationSymbols),
          purchasePrice: weapon.purchasePrice,
          purchasedAt: weapon.purchasedAt,
          lastUpgrade: this.resolveUpgrade(weapon.lastUpgrade),
          loadoutIds: loadoutIdsByWeapon.get(weapon.id) ?? [],
          updatedAt: weapon.updatedAt
        }
      })
      .sort(compareEquipment)
    const timestamps = [currentState?.timestamp, ...loadouts.map(item => item.updatedAt), ...suits.map(item => item.updatedAt), ...weapons.map(item => item.updatedAt)]
      .filter((timestamp): timestamp is string => timestamp !== undefined)

    return CommanderEquipmentResponseSchema.parse({
      schemaVersion: 1,
      ownershipCoverage: 'observed',
      currentLoadoutId,
      updatedAt: timestamps.sort().at(-1) ?? null,
      loadouts: loadouts.map(({ id, name, suitId, slots, updatedAt }) => ({ id, name, suitId, slots, updatedAt })),
      suits,
      weapons,
      summary: { loadouts: loadouts.length, suits: suits.length, weapons: weapons.length }
    })
  }

  private ingestSuit (event: EliteJournalEvent, change: EquipmentChange): void {
    const id = integer(event.SuitID)
    const symbol = text(event.Name) ?? text(event.SuitName)
    if (id === null || symbol === null) return
    this.putSuit(id, symbol, localized(event.Name_Localised) ?? localized(event.SuitName_Localised), event, change)
  }

  private ingestWeapon (event: EliteJournalEvent, change: EquipmentChange): void {
    const id = integer(event.SuitModuleID)
    const symbol = text(event.Name) ?? text(event.ModuleName)
    if (id === null || symbol === null) return
    this.putWeapon(id, symbol, localized(event.Name_Localised) ?? localized(event.ModuleName_Localised), event, change)
  }

  private ingestLoadoutSnapshot (event: EliteJournalEvent, current: boolean): void {
    const id = integer(event.LoadoutID)
    const suitId = integer(event.SuitID)
    if (id === null || suitId === null) return
    const existing = this.repository.getLoadout(id)
    if (!existing || event.timestamp >= existing.updatedAt) {
      const slots = Array.isArray(event.Modules)
        ? event.Modules.flatMap(module => {
            if (!record(module)) return []
            const weaponId = integer(module.SuitModuleID)
            const slot = text(module.SlotName)
            return weaponId === null || slot === null ? [] : [{ slot, weaponId }]
          })
        : existing?.slots ?? []
      this.repository.putLoadout({
        schemaVersion: 1,
        id,
        name: text(event.LoadoutName) ?? existing?.name ?? `Loadout ${id}`,
        suitId,
        slots,
        state: 'observed',
        updatedAt: event.timestamp
      })
      if (current) this.putCurrentLoadout(id, event.timestamp)
    }

    const suitSymbol = text(event.SuitName)
    if (suitSymbol) this.putSuit(suitId, suitSymbol, localized(event.SuitName_Localised), event, {})
    if (Array.isArray(event.Modules)) for (const module of event.Modules) {
      if (!record(module)) continue
      const weaponId = integer(module.SuitModuleID)
      const symbol = text(module.ModuleName)
      if (weaponId !== null && symbol !== null) {
        this.putWeapon(weaponId, symbol, localized(module.ModuleName_Localised), { ...module, timestamp: event.timestamp, event: event.event }, {})
      }
    }
  }

  private deleteLoadout (event: EliteJournalEvent): void {
    const id = integer(event.LoadoutID)
    const suitId = integer(event.SuitID)
    if (id === null || suitId === null) return
    const existing = this.repository.getLoadout(id)
    if (existing && event.timestamp < existing.updatedAt) return
    this.repository.putLoadout({
      schemaVersion: 1,
      id,
      name: text(event.LoadoutName) ?? existing?.name ?? `Loadout ${id}`,
      suitId,
      slots: existing?.slots ?? [],
      state: 'deleted',
      updatedAt: event.timestamp
    })
    const current = this.repository.getProjectionState(CURRENT_LOADOUT)
    if (integer(current?.value) === id) this.putCurrentLoadout(null, event.timestamp)
  }

  private renameLoadout (event: EliteJournalEvent): void {
    const id = integer(event.LoadoutID)
    const name = text(event.LoadoutName) ?? text(event.Loadoutname)
    if (id === null || name === null) return
    const existing = this.repository.getLoadout(id)
    if (!existing || event.timestamp < existing.updatedAt) return
    this.repository.putLoadout({ ...existing, name, updatedAt: event.timestamp })
  }

  private equipLoadoutModule (event: EliteJournalEvent): void {
    const id = integer(event.LoadoutID)
    const suitId = integer(event.SuitID)
    const weaponId = integer(event.SuitModuleID)
    const slot = text(event.SlotName)
    if (id === null || suitId === null || weaponId === null || slot === null) return
    const existing = this.repository.getLoadout(id)
    if (existing && event.timestamp < existing.updatedAt) return
    const slots = [...(existing?.slots ?? []).filter(item => item.slot !== slot), { slot, weaponId }]
    this.repository.putLoadout({
      schemaVersion: 1,
      id,
      name: text(event.LoadoutName) ?? existing?.name ?? `Loadout ${id}`,
      suitId,
      slots,
      state: 'observed',
      updatedAt: event.timestamp
    })
    const suitSymbol = text(event.SuitName)
    if (suitSymbol) this.putSuit(suitId, suitSymbol, localized(event.SuitName_Localised), event, {})
    const weaponSymbol = text(event.ModuleName)
    if (weaponSymbol) this.putWeapon(weaponId, weaponSymbol, localized(event.ModuleName_Localised), event, {})
  }

  private removeLoadoutModule (event: EliteJournalEvent): void {
    const id = integer(event.LoadoutID)
    const slot = text(event.SlotName)
    if (id === null || slot === null) return
    const existing = this.repository.getLoadout(id)
    if (!existing || event.timestamp < existing.updatedAt) return
    this.repository.putLoadout({
      ...existing,
      slots: existing.slots.filter(item => item.slot !== slot),
      updatedAt: event.timestamp
    })
    const weaponId = integer(event.SuitModuleID)
    const weaponSymbol = text(event.ModuleName)
    if (weaponId !== null && weaponSymbol) this.putWeapon(weaponId, weaponSymbol, localized(event.ModuleName_Localised), event, {})
  }

  private putSuit (
    id: number,
    symbol: string,
    localizedName: string | null,
    event: EliteJournalEvent,
    change: EquipmentChange
  ): void {
    this.repository.putSuit(mergeEquipment(this.repository.getSuit(id), id, symbol, localizedName, event, change))
  }

  private putWeapon (
    id: number,
    symbol: string,
    localizedName: string | null,
    event: EliteJournalEvent,
    change: EquipmentChange
  ): void {
    this.repository.putWeapon(mergeEquipment(this.repository.getWeapon(id), id, symbol, localizedName, event, change))
  }

  private putCurrentLoadout (id: number | null, timestamp: string): void {
    const current = this.repository.getProjectionState(CURRENT_LOADOUT)
    if (current && timestamp < current.timestamp) return
    this.repository.putProjectionState(CURRENT_LOADOUT, { value: id === null ? '' : String(id), timestamp })
  }

  private resolveModifications (symbols: string[]) {
    return symbols.map(symbol => ({ symbol, displayName: this.catalogue.resolveModification(symbol) }))
  }

  private resolveUpgrade (upgrade: CommanderEquipmentUpgradeRecord | null) {
    if (!upgrade) return null
    return {
      grade: upgrade.grade,
      credits: upgrade.credits,
      resources: upgrade.resources.map(resource => ({
        symbol: resource.symbol,
        displayName: this.catalogue.resolveResource(resource.symbol, resource.localizedName),
        count: resource.count
      } satisfies CommanderEquipmentUpgradeResource)),
      updatedAt: upgrade.updatedAt
    }
  }
}

interface EquipmentChange {
  purchase?: boolean
  state?: CommanderSuitRecord['state']
  upgrade?: boolean
}

function mergeEquipment<T extends CommanderSuitRecord | CommanderWeaponRecord> (
  current: T | null,
  id: number,
  symbol: string,
  localizedName: string | null,
  event: EliteJournalEvent,
  change: EquipmentChange
): T {
  const newer = !current || event.timestamp >= current.updatedAt
  const eventGrade = grade(event.Class) ?? gradeFromSymbol(symbol)
  const eventModifications = strings(event.SuitMods) ?? strings(event.WeaponMods)
  const upgrade = change.upgrade ? upgradeRecord(event, eventGrade) : null
  const purchasePrice = change.purchase ? integer(event.Price) : null
  return {
    schemaVersion: 1,
    id,
    symbol: newer ? symbol : current.symbol,
    localizedName: newer ? localizedName ?? current?.localizedName ?? null : current.localizedName,
    grade: newer ? eventGrade ?? current?.grade ?? null : current.grade ?? eventGrade,
    modificationSymbols: newer && eventModifications !== null ? eventModifications : current?.modificationSymbols ?? [],
    purchasePrice: purchasePrice !== null && (!current?.purchasedAt || event.timestamp >= current.purchasedAt)
      ? purchasePrice
      : current?.purchasePrice ?? null,
    purchasedAt: purchasePrice !== null && (!current?.purchasedAt || event.timestamp >= current.purchasedAt)
      ? event.timestamp
      : current?.purchasedAt ?? null,
    lastUpgrade: upgrade && (!current?.lastUpgrade || upgrade.updatedAt >= current.lastUpgrade.updatedAt)
      ? upgrade
      : current?.lastUpgrade ?? null,
    state: newer ? change.state ?? 'observed' : current.state,
    updatedAt: newer ? event.timestamp : current.updatedAt
  } as T
}

function upgradeRecord (event: EliteJournalEvent, eventGrade: number | null): CommanderEquipmentUpgradeRecord | null {
  if (eventGrade === null) return null
  const resources = new Map<string, CommanderEquipmentUpgradeRecord['resources'][number]>()
  if (Array.isArray(event.Resources)) for (const candidate of event.Resources) {
    if (!record(candidate)) continue
    const symbol = text(candidate.Name)
    const count = integer(candidate.Count)
    if (symbol === null || count === null || count <= 0) continue
    const key = symbol.toLowerCase()
    const current = resources.get(key)
    resources.set(key, {
      symbol: current?.symbol ?? symbol,
      localizedName: current?.localizedName ?? localized(candidate.Name_Localised),
      count: (current?.count ?? 0) + count
    })
  }
  return {
    grade: eventGrade,
    credits: integer(event.Cost) ?? 0,
    resources: [...resources.values()],
    updatedAt: event.timestamp
  }
}

function associations (pairs: ReadonlyArray<readonly [number, number]>): Map<number, number[]> {
  const result = new Map<number, Set<number>>()
  for (const [equipmentId, loadoutId] of pairs) {
    const ids = result.get(equipmentId) ?? new Set<number>()
    ids.add(loadoutId)
    result.set(equipmentId, ids)
  }
  return new Map([...result].map(([id, loadoutIds]) => [id, [...loadoutIds].sort((left, right) => left - right)]))
}

function compareEquipment (left: { displayName: string, grade: number | null, id: number }, right: { displayName: string, grade: number | null, id: number }): number {
  return left.displayName.localeCompare(right.displayName) || (right.grade ?? 0) - (left.grade ?? 0) || left.id - right.id
}

function gradeFromSymbol (symbol: string): number | null {
  return grade(symbol.match(/_class([1-5])$/iu)?.[1])
}

function grade (value: unknown): number | null {
  const candidate = integer(value)
  return candidate !== null && candidate >= 1 && candidate <= 5 ? candidate : null
}

function integer (value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+$/u.test(value)) return Number.parseInt(value, 10)
  return null
}

function localized (value: unknown): string | null {
  return text(value)
}

function strings (value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0) : null
}

function text (value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function record (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
