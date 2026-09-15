import type { CommanderEquipmentResponse } from '@phoenix/contracts'

export type CommanderEquipmentRecordState = 'observed' | 'sold'

export interface CommanderEquipmentUpgradeRecord {
  grade: number
  credits: number
  resources: Array<{
    symbol: string
    localizedName: string | null
    count: number
  }>
  updatedAt: string
}

export interface CommanderSuitRecord {
  schemaVersion: 1
  id: number
  symbol: string
  localizedName: string | null
  grade: number | null
  modificationSymbols: string[]
  purchasePrice: number | null
  purchasedAt: string | null
  lastUpgrade: CommanderEquipmentUpgradeRecord | null
  state: CommanderEquipmentRecordState
  updatedAt: string
}

export type CommanderWeaponRecord = CommanderSuitRecord

export interface CommanderSuitLoadoutRecord {
  schemaVersion: 1
  id: number
  name: string
  suitId: number
  slots: Array<{ slot: string, weaponId: number }>
  state: 'observed' | 'deleted'
  updatedAt: string
}

export interface CommanderEquipmentProjectionState {
  timestamp: string
  value: string
}

export interface CommanderEquipmentRepository {
  getLoadout(id: number): CommanderSuitLoadoutRecord | null
  getProjectionState(key: string): CommanderEquipmentProjectionState | null
  getSuit(id: number): CommanderSuitRecord | null
  getWeapon(id: number): CommanderWeaponRecord | null
  listLoadouts(): CommanderSuitLoadoutRecord[]
  listSuits(): CommanderSuitRecord[]
  listWeapons(): CommanderWeaponRecord[]
  putLoadout(loadout: CommanderSuitLoadoutRecord): void
  putProjectionState(key: string, state: CommanderEquipmentProjectionState): void
  putSuit(suit: CommanderSuitRecord): void
  putWeapon(weapon: CommanderWeaponRecord): void
}

export interface CommanderEquipmentReader {
  getEquipment(): CommanderEquipmentResponse
}

export interface CommanderEquipmentDefinition {
  displayName: string
  manufacturer: string | null
  category: string | null
  damageType: string | null
}

export interface CommanderEquipmentCatalogue {
  resolveModification(symbol: string): string
  resolveResource(symbol: string, localizedName: string | null): string
  resolveSuit(symbol: string, localizedName: string | null): CommanderEquipmentDefinition
  resolveWeapon(symbol: string, localizedName: string | null): CommanderEquipmentDefinition
}
