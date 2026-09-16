import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { PersonalEquipmentReportReader } from '../../domain/personal-equipment-report.js'
import { emptyObjectSchema, json, output } from './tool-support.js'

export class EquipmentGetReportTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return one coherent personal-equipment report containing observed suits, weapons and loadouts; Ship Locker and Backpack materials; relevant grade and modification recipes; specialist access and locations; and explicit unknowns. Use this report to reason about equipment engineering without calling several list tools. An absent material means zero only when materialInventoryComplete is true. Mission-tagged quantities are separate and must not be assumed expendable.',
    inputSchema: emptyObjectSchema(),
    name: 'equipment.get_equipment_report'
  }

  public constructor (private readonly reports: PersonalEquipmentReportReader) {}

  public readonly execute = (_arguments: JsonObject) => {
    const report = this.reports.getReport()
    const suits = report.ownedEquipment.filter(item => item.kind === 'suit').length
    const weapons = report.ownedEquipment.length - suits
    const text = [
      'Personal equipment report:',
      `- Observed equipment: ${suits} suits and ${weapons} weapons across ${report.loadouts.length} loadouts.`,
      `- Observed material entries: ${report.materials.length}.`,
      `- Catalogue: ${report.gradeUpgradePaths.length} grade paths, ${report.modifications.length} modifications, and ${report.specialists.length} specialists.`,
      `- Explicit unknowns: ${report.unknowns.length}.`,
      'Use the structured report for equipment and upgrade reasoning. Mission-tagged quantities are separate and are not confirmed as expendable.'
    ].join('\n')
    return output(text, json(report))
  }
}
