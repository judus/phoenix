import type { PersonalEquipmentSpecialistsResponse } from '@phoenix/contracts'

export interface PersonalEquipmentSpecialistsReader {
  getSpecialists(): PersonalEquipmentSpecialistsResponse
}
