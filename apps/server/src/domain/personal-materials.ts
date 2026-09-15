import type { PersonalMaterialInventoryResponse } from '@phoenix/contracts'

export interface PersonalMaterialInventoryReader {
  getInventory(): PersonalMaterialInventoryResponse
}
