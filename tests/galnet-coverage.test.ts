import { expect, test } from 'vitest'
import { GalnetCoverageService } from '../apps/server/src/application/galnet-coverage-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { SavedGalnetAnalysisService } from '../apps/server/src/application/saved-galnet-analysis-service.js'
import { analysisArticle, savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

test('related reports use exact ship/person subjects and publication chronology, not analysis time', () => {
  const db = new SqliteDatabase(':memory:'); db.initialize()
  try {
    for (const [id, name, kind, publishedAt, analysedAt] of [
      ['missing', 'EVE-597', 'ship', '2026-09-17T12:00:00Z', '2026-10-08T12:00:00Z'],
      ['found', 'eve-597', 'ship', '2026-09-22T12:00:00Z', '2026-10-07T12:00:00Z'],
      ['faction', 'EVE-597', 'faction', '2026-09-23T12:00:00Z', '2026-10-07T12:00:00Z'],
      ['other-ship', 'EVE-5970', 'ship', '2026-09-23T12:00:00Z', '2026-10-07T12:00:00Z']
    ] as const) {
      const article = { ...analysisArticle, id, publishedAt }
      db.galnetArchive.observe([article], analysedAt)
      const report = savedGalnetAnalysis({ articleId: id, cacheKey: id, publishedAt, analysedAt,
        articleRevisionId: db.galnetArchive.getArticle(id)!.revisionId })
      report.content.entities = [{ name, kind, role: 'Reported ship', evidence: 'Synthetic evidence' }]
      if (id === 'missing') report.content.entities.push(report.content.entities[0]!,
        { name: 'UNSHARED', kind: 'person', role: 'Not shared', evidence: 'Synthetic evidence' })
      db.galnetAnalyses.put(report)
    }
    const service = new GalnetCoverageService(new SavedGalnetAnalysisService(db.galnetAnalyses, db.galnetArchive))
    expect(service.get('missing').reports.map(saved => saved.analysis.articleId)).toEqual(['missing', 'found'])
    expect(service.get('missing').subjects).toEqual(['EVE-597'])
    expect(service.get('unknown')).toEqual({ subjects: [], reports: [] })
    db.galnetArchive.observe([{ ...analysisArticle, id: 'found', title: 'Changed', publishedAt: '2026-09-22T12:00:00Z' }], '2026-10-08T12:00:00Z')
    expect(service.get('missing').reports.map(saved => saved.analysis.articleId)).toEqual(['missing'])
    expect(service.get('missing').subjects).toEqual([])
    expect(service.get('found')).toEqual({ subjects: [], reports: [] })
  } finally { db.close() }
})
