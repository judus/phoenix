import type { GalnetArticleArchive, GalnetArticleRevision } from '../domain/galnet.js'
import type { GalnetAnalysisRepository, GalnetStoryContext } from '../domain/galnet-analysis.js'

/** Candidate retrieval only: a shared name never establishes story membership or resolves a lead. */
export function galnetStoryContext(article: GalnetArticleRevision, archive: Pick<GalnetArticleArchive, 'getArticle'>,
  reports: Pick<GalnetAnalysisRepository, 'recent'>): GalnetStoryContext[] {
  const text = `${article.article.title}\n${article.article.body}`
  const contexts: GalnetStoryContext[] = []
  const candidates = reports.recent(100).filter(report => report.articleId !== article.article.id &&
    Date.parse(report.publishedAt) < Date.parse(article.article.publishedAt) &&
    report.content.entities.some(entity => (entity.kind === 'ship' || entity.kind === 'person') && mentionsName(text, entity.name)))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.articleId.localeCompare(b.articleId))
  for (const report of candidates) {
    const revision = archive.getArticle(report.articleId)
    if (!revision || revision.revisionId !== report.articleRevisionId) continue
    const linked = new Set(report.content.activities.map(activity => activity.communityGoalId))
    contexts.push({ source: { articleId: report.articleId, articleRevisionId: report.articleRevisionId,
      analysisCacheKey: report.cacheKey, title: revision.article.title, sourceUrl: report.sourceUrl,
      publishedAt: report.publishedAt, communityGoals: { ...report.communityGoals,
        goals: report.communityGoals.goals.filter(goal => linked.has(goal.id)) } }, article: revision.article,
      activities: report.content.activities.map((activity, index) => ({ leadId: `galnet-lead:${report.cacheKey}:${index}`, activity })) })
    if (contexts.length === 5) break
  }
  return contexts
}

function mentionsName(text: string, name: string): boolean {
  const literal = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return literal.length > 0 && new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_-])${literal}(?![\\p{L}\\p{N}\\p{M}_-])`, 'iu').test(text)
}
