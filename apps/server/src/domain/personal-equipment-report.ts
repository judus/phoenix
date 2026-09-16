import type { PersonalEquipmentReportResponse } from '@phoenix/contracts'

export interface PersonalEquipmentReportReader {
  getReport(): PersonalEquipmentReportResponse
}
