import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { EngineeringProjects } from '../../domain/engineering-projects.js'
import { emptyObjectSchema, json, output } from './tool-support.js'

export class EngineeringGetProjectReportTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Report active saved ship engineering projects, planned blueprint grades/rolls and experimental-effect applications, and material requirements aggregated across all active projects. Shared observed stock is counted once, not independently per project. Includes satisfied requirements; owned/missing are null when inventory is unavailable. Plans do not prove completion and cover only explicitly planned grades, not preceding grades. Personal-equipment plans are unsaved previews and are not available here. Read-only: does not change projects or inventory.',
    inputSchema: emptyObjectSchema(),
    name: 'engineering.get_project_report'
  }

  public constructor (private readonly projects: Pick<EngineeringProjects, 'getReport'>) {}

  public readonly execute = (_arguments: JsonObject) => {
    const report = this.projects.getReport()
    return output([
      `Active engineering projects: ${report.projects.length}.`,
      report.inventoryAvailable
        ? `Materials with shortfalls: ${report.materials.filter(material => material.missing !== null && material.missing > 0).length}. Inventory observed at ${report.observedAt}.`
        : 'Inventory is unavailable; owned quantities and shortfalls are unknown, not zero.',
      'Use the structured report for targets and shared material totals. Planned rolls cover only the listed grades; do not infer completion.',
      'Personal-equipment plans are unsaved previews, not saved projects.'
    ].join('\n'), json(report))
  }
}
