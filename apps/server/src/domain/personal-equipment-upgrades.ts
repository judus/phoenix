import type { PersonalEquipmentUpgradesResponse } from '@phoenix/contracts'

export interface PersonalEquipmentUpgradesReader {
  getUpgrades(): PersonalEquipmentUpgradesResponse
}
