import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { SqliteGalnetArticleArchive } from '../apps/server/src/infrastructure/sqlite-galnet-article-archive.js'

const article = {
  body: 'Synthetic report.', id: 'report-1', image: null, title: 'Synthetic news',
  publishedAt: '2026-10-01T11:00:00+00:00', changedAt: '2026-10-01T11:00:00+00:00',
  slug: 'synthetic-news', sourceUrl: 'https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article/report-1'
}
const first = '2026-10-02T10:00:00.000Z'
const second = '2026-10-02T11:00:00.000Z'

test('archive deduplicates observations, retains changed evidence and tracks current even after a reversion', () => {
  const db = new SqliteDatabase(':memory:')
  db.initialize()
  try {
    const archive = db.galnetArchive
    expect(archive.getArticle(article.id)).toBeNull()
    archive.observe([article], first)
    const original = archive.getArticle(article.id)!
    // Different object key insertion order must not manufacture a revision.
    const { sourceUrl, ...rest } = article
    archive.observe([{ sourceUrl, ...rest }], second)
    expect(archive.listRevisions(article.id)).toEqual([{ ...original, lastObservedAt: second }])
    const changed = { ...article, body: 'Corrected synthetic report.', changedAt: '2026-10-02T11:00:00+00:00' }
    archive.observe([changed], second)
    expect(archive.getArticle(article.id)?.article).toEqual(changed)
    expect(archive.listRevisions(article.id).map(revision => revision.article.body)).toEqual([changed.body, article.body])
    archive.observe([article], '2026-10-02T12:00:00.000Z')
    expect(archive.getArticle(article.id)?.revisionId).toBe(original.revisionId)
    expect(archive.listRevisions(article.id)).toHaveLength(2)
    archive.observe([], '2026-10-02T13:00:00.000Z')
    expect(archive.getArticle(article.id)?.article).toEqual(article)
  } finally { db.close() }
})

test('archive survives restart and initialization is idempotent on an existing database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-archive-'))
  const path = join(directory, 'state.sqlite')
  try {
    const before = new SqliteDatabase(path)
    before.initialize()
    before.galnetArchive.observe([article], first)
    const retained = before.galnetArchive.getArticle(article.id)
    before.close()
    const after = new SqliteDatabase(path)
    try {
      after.initialize()
      after.initialize()
      expect(after.galnetArchive.getArticle(article.id)).toEqual(retained)
      after.galnetArchive.observe([{ ...article, title: 'Revised title' }], second)
      expect(after.galnetArchive.listRevisions(article.id)).toHaveLength(2)
    } finally { after.close() }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('archive batch rolls back revisions and current pointers together on storage failure', () => {
  const connection = new DatabaseSync(':memory:')
  connection.exec('PRAGMA foreign_keys = ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;')
  const archive = new SqliteGalnetArticleArchive(connection)
  try {
    archive.initialize()
    archive.observe([article], first)
    connection.exec(`CREATE TRIGGER fail_article BEFORE INSERT ON galnet_articles
      WHEN NEW.article_id = 'fail' BEGIN SELECT RAISE(ABORT, 'synthetic disk failure'); END;`)
    expect(() => archive.observe([{ ...article, body: 'New version' }, { ...article, id: 'fail' }], second)).toThrow('synthetic disk failure')
    expect(archive.getArticle(article.id)?.article).toEqual(article)
    expect(archive.listRevisions(article.id)).toHaveLength(1)
    expect(archive.listRevisions('fail')).toEqual([])
  } finally { connection.close() }
})

test('archive rejects invalid source metadata before recording any article from a batch', () => {
  const db = new SqliteDatabase(':memory:')
  db.initialize()
  try {
    expect(() => db.galnetArchive.observe([article, { ...article, id: 'bad', changedAt: 'not a date' }], first)).toThrow()
    expect(db.galnetArchive.getArticle(article.id)).toBeNull()
  } finally { db.close() }
})

test('archive migration adds history without changing the existing latest-feed cache', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-upgrade-'))
  const path = join(directory, 'state.sqlite')
  try {
    const legacy = new SqliteDatabase(path)
    legacy.initialize()
    legacy.putProviderResponse('frontier-galnet', 'latest', first, [{ id: 'legacy-feed-evidence' }])
    legacy.close()
    const connection = new DatabaseSync(path)
    connection.exec('PRAGMA foreign_keys = ON; DROP TABLE galnet_articles; DROP TABLE galnet_article_revisions; DELETE FROM schema_migrations WHERE version = 26;')
    connection.close()
    const upgraded = new SqliteDatabase(path)
    try {
      upgraded.initialize()
      expect(upgraded.getProviderResponse('frontier-galnet', 'latest')).toEqual({ fetchedAt: first, value: [{ id: 'legacy-feed-evidence' }] })
      expect(upgraded.galnetArchive.getArticle('legacy-feed-evidence')).toBeNull()
      upgraded.galnetArchive.observe([article], second)
      expect(upgraded.galnetArchive.getArticle(article.id)?.article).toEqual(article)
    } finally { upgraded.close() }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
