import type { GalnetCoverageResponse } from '@phoenix/contracts'
import type { SavedGalnetAnalysisReader } from '../domain/galnet-analysis.js'

/** Related evidence, not automatic story membership or activity lifecycle decisions. */
export class GalnetCoverageService {
  public constructor(private readonly reports: SavedGalnetAnalysisReader) {}

  public get(articleId: string): GalnetCoverageResponse {
    const selected = this.reports.get(articleId)
    if (!selected || selected.articleChanged) return { subjects: [], reports: [] }
    // Exact named ships/people are useful candidates. Shared systems/factions alone are too broad.
    const subjects = selected.analysis.content.entities.filter(entity => entity.kind === 'ship' || entity.kind === 'person')
    const keys = new Set(subjects.map(entity => `${entity.kind}:${entity.name.trim().toLowerCase()}`))
    const related = this.reports.recent(100).filter(saved => saved.analysis.articleId !== articleId &&
      !saved.articleChanged && saved.analysis.content.entities.some(entity => keys.has(`${entity.kind}:${entity.name.trim().toLowerCase()}`)))
    related.push(selected)
    return { subjects: subjects.map(entity => entity.name), reports: related.sort((a, b) =>
      Date.parse(a.analysis.publishedAt) - Date.parse(b.analysis.publishedAt) || a.analysis.articleId.localeCompare(b.analysis.articleId)) }
  }
}
