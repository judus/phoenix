import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { SqliteGalnetAnalysisRepository } from '../apps/server/src/infrastructure/sqlite-galnet-analysis-repository.js'
import { savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

test('migration selects existing latest reports and keeps explicit cached selection across a real reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-reports-'))
  const path = join(directory, 'reports.sqlite')
  let connection = new DatabaseSync(path)
  try {
    // Real pre-migration layout, including timestamp ties and an older report inserted last.
    connection.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;
      CREATE TABLE galnet_analyses (cache_key TEXT PRIMARY KEY, article_id TEXT NOT NULL,
        analysed_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;`)
    const original = savedGalnetAnalysis()
    const tied = savedGalnetAnalysis({ cacheKey: 'tied' })
    const older = savedGalnetAnalysis({ cacheKey: 'older', analysedAt: '2026-10-06T12:00:00Z' })
    const another = savedGalnetAnalysis({ cacheKey: 'another', articleId: 'another' })
    const insert = connection.prepare('INSERT INTO galnet_analyses VALUES (?, ?, ?, ?)')
    for (const report of [original, tied, another, older]) {
      insert.run(report.cacheKey, report.articleId, report.analysedAt, JSON.stringify(report))
    }
    let repository = new SqliteGalnetAnalysisRepository(connection)
    repository.initialize()
    expect(repository.latest(original.articleId)).toEqual(tied)
    expect(repository.recent(10)).toEqual([another, tied])
    repository.put(older)
    connection.close()
    connection = new DatabaseSync(path)
    repository = new SqliteGalnetAnalysisRepository(connection)
    repository.initialize()
    expect(repository.latest(original.articleId)).toEqual(older)
    expect(repository.recent(10)).toEqual([another, older])
    expect(repository.get(tied.cacheKey)).toEqual(tied)
    expect(repository.get(older.cacheKey)).toEqual(older) // No invented new analysis timestamp.
  } finally { connection.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('a selection write failure rolls back the new report and preserves the previous selection', () => {
  const connection = new DatabaseSync(':memory:')
  try {
    connection.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT')
    const repository = new SqliteGalnetAnalysisRepository(connection)
    repository.initialize()
    const original = savedGalnetAnalysis()
    repository.put(original)
    connection.exec(`CREATE TRIGGER fail_selection BEFORE UPDATE ON galnet_analysis_heads
      BEGIN SELECT RAISE(ABORT, 'Synthetic selection failure'); END;`)
    expect(() => repository.put({ ...original, cacheKey: 'new-report' })).toThrow('Synthetic selection failure')
    expect(repository.get('new-report')).toBeNull()
    expect(repository.latest(original.articleId)).toEqual(original)
    expect(repository.recent(10)).toEqual([original])
    // The failed transaction does not leave the connection locked in a transaction.
    connection.exec('DROP TRIGGER fail_selection')
    repository.put({ ...original, cacheKey: 'new-report' })
    expect(repository.latest(original.articleId)?.cacheKey).toBe('new-report')
  } finally { connection.close() }
})
