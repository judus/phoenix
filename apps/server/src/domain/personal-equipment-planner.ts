import type {
  PersonalEquipmentPlannerOptionsResponse,
  PersonalEquipmentPlanPreviewRequest,
  PersonalEquipmentPlanPreviewResponse
} from '@phoenix/contracts'

export interface PersonalEquipmentPlanner {
  getOptions(): PersonalEquipmentPlannerOptionsResponse
  preview(request: PersonalEquipmentPlanPreviewRequest): PersonalEquipmentPlanPreviewResponse
}
