import type { GalnetArticleArchive, GalnetArticleRevision } from '../domain/galnet.js'
import type { GalnetAnalysisRepository, GalnetStoryContext } from '../domain/galnet-analysis.js'

/** Candidate retrieval only: a shared name never establishes story membership or resolves a lead. */
export function galnetStoryContext(article: GalnetArticleRevision, archive: Pick<GalnetArticleArchive, 'getArticle'>,
  reports: Pick<GalnetAnalysisRepository, 'recent'>): GalnetStoryContext[] {
  const text = `${article.article.title}\n${article.article.body}`
  const contexts: GalnetStoryContext[] = []
  const candidates = reports.recent(100).filter(report => report.articleId !== article.article.id &&
    Date.parse(report.publishedAt) < Date.parse(article.article.publishedAt))
    .map(report => ({ report, score: relevance(text, report) })).filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.report.publishedAt) - Date.parse(a.report.publishedAt) ||
      a.report.articleId.localeCompare(b.report.articleId)).map(candidate => candidate.report)
  for (const report of candidates) {
    const revision = archive.getArticle(report.articleId)
    if (!revision || revision.revisionId !== report.articleRevisionId) continue
    const linked = new Set(report.content.activities.map(activity => activity.communityGoalId))
    contexts.push({ source: { articleId: report.articleId, articleRevisionId: report.articleRevisionId,
      analysisCacheKey: report.cacheKey, title: revision.article.title, sourceUrl: report.sourceUrl,
      publishedAt: report.publishedAt, communityGoals: { ...report.communityGoals,
        goals: report.communityGoals.goals.filter(goal => linked.has(goal.id)) } }, article: revision.article,
      activities: report.content.activities.flatMap((activity, index) => activity.communityGoalId === null
        ? [{ leadId: `galnet-lead:${report.cacheKey}:${index}`, activity }] : []) })
    if (contexts.length === 5) break
  }
  return contexts
}

function relevance(text: string, report: ReturnType<GalnetAnalysisRepository['recent']>[number]): number {
  const independent = report.content.activities.filter(activity => activity.communityGoalId === null && activity.status !== 'ended')
  let score = 0
  for (const entity of report.content.entities) {
    if (!mentionsName(text, entity.name)) continue
    if (entity.kind === 'ship' || entity.kind === 'person') score = Math.max(score, 3)
    else if (entity.kind === 'system' && report.schemaVersion !== 1 && report.content.activities.some(activity =>
      activity.communityGoalId === null && activity.status !== 'ended' &&
      activity.destination?.systemName.toLowerCase() === entity.name.toLowerCase())) score = Math.max(score, 2)
    else if (entity.kind === 'faction' && independent.length > 0) score = Math.max(score, 1)
  }
  return score
}

function mentionsName(text: string, name: string): boolean {
  const literal = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return literal.length > 0 && new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_-])${literal}(?![\\p{L}\\p{N}\\p{M}_-])`, 'iu').test(text)
}
