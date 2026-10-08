import { AiError } from '@jdu/llm-client'
import { GalnetContinuitySchema, type CommunityGoalsResponse, type GalnetAnalysisContent, type GalnetContinuity } from '@phoenix/contracts'
import type { GalnetArticleRevision } from '../domain/galnet.js'
import type { GalnetStoryContext } from '../domain/galnet-analysis.js'
import { createGalnetQuoteResolver } from './galnet-quote-resolver.js'

/** Source identity/quote checks constrain model claims; they cannot prove their interpretation. */
export function validateGalnetContinuity(value: GalnetContinuity | null, article: GalnetArticleRevision,
  context: GalnetStoryContext[], content: GalnetAnalysisContent, goals: CommunityGoalsResponse): GalnetContinuity | null {
  if (value === null) return null
  const story = GalnetContinuitySchema.parse(value)
  const related = new Set(story.relatedArticleIds)
  if (related.size !== story.relatedArticleIds.length || [...related].some(id => !context.some(entry => entry.source.articleId === id))) invalid('relatedArticleIds', 'unknown or duplicate related article')
  const sources = new Map([[article.article.id, article.article], ...context.filter(entry => related.has(entry.source.articleId))
    .map(entry => [entry.source.articleId, entry.article] as const)])
  const quote = (evidence: { articleId: string, quote: string }, path: string) => {
    const source = sources.get(evidence.articleId)
    const restored = source && createGalnetQuoteResolver(source.title, source.body)(evidence.quote)
    if (restored === undefined || restored.length > 800) invalid(path, `unverified source quote ${JSON.stringify(evidence.quote)}`)
    evidence.quote = restored
    return source!
  }
  story.developments.forEach((development, index) => quote(development.evidence, `developments[${index}].evidence`))
  const updated = new Set<string>()
  for (const [index, update] of story.updates.entries()) {
    const path = `updates[${index}]`
    const origin = context.find(entry => related.has(entry.source.articleId) && entry.activities.some(activity => activity.leadId === update.leadId && activity.activity.communityGoalId === null))
    if (!origin || updated.has(update.leadId)) invalid(path, 'unknown, linked or duplicate prior lead')
    updated.add(update.leadId)
    const source = quote(update.evidence, `${path}.evidence`)
    if (update.disposition !== 'unresolved' && Date.parse(source.publishedAt) <= Date.parse(origin.source.publishedAt)) invalid(path, 'resolution requires later source evidence')
    if (update.disposition === 'superseded') {
      const replacement = update.replacementActivityIndex === null ? undefined : content.activities[update.replacementActivityIndex]
      if (!replacement || replacement.communityGoalId !== null || replacement.status === 'ended' || source.id !== article.article.id) invalid(path, 'replacement must identify an unlinked current activity with current-article evidence')
    } else if (update.replacementActivityIndex !== null) invalid(path, 'only superseded leads have a replacement activity')
    if (update.disposition === 'community-goal') {
      if (update.communityGoalId === null || ![goals, ...context.filter(entry => related.has(entry.source.articleId)).map(entry => entry.source.communityGoals)]
        .some(snapshot => snapshot.goals.some(goal => goal.id === update.communityGoalId))) invalid(path, 'unknown Community Goal reference')
    } else if (update.communityGoalId !== null) invalid(path, 'only Community Goal reconciliation has a campaign reference')
  }
  return story
}

function invalid(path: string, reason: string): never {
  throw new AiError('structured_output_validation', `Invalid story ${path}: ${reason}. Nothing was saved; no automatic retry was made.`, { code: 'galnet_analysis_invalid_continuity' })
}
