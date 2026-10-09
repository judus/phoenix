import type { GalnetArchivedArticle, GalnetArchiveQuery } from '@phoenix/contracts'
import type { GalnetArchiveBrowser } from '../domain/galnet.js'

/** Local retained evidence only; never refreshes sources or requests analysis. */
export class GalnetArchiveService {
  public constructor(private readonly archive: GalnetArchiveBrowser) {}

  public search(query: GalnetArchiveQuery) {
    return this.archive.search(query)
  }

  public get(articleId: string): GalnetArchivedArticle | null {
    const retained = this.archive.getArticle(articleId)
    if (!retained) return null
    const { sourceUrl, changedAt, slug: _slug, ...article } = retained.article
    return { article, sourceUrl, changedAt, revisionId: retained.revisionId,
      firstObservedAt: retained.firstObservedAt, lastObservedAt: retained.lastObservedAt }
  }
}
