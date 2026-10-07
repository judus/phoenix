import type { CommunityGoalsResponse, GalnetAnalysis, GalnetAnalysisContent } from '@phoenix/contracts'

export const analysisArticle = { id: 'synthetic-analysis', title: 'Synthetic research campaign',
  body: 'Pilots should deliver supplies to Galileo in Sol. A separate beacon in Colonia needs investigation.',
  image: null, publishedAt: '2026-10-01T12:00:00Z', changedAt: '2026-10-01T12:00:00Z',
  slug: 'synthetic-research', sourceUrl: 'https://example.com/galnet/synthetic-analysis' }

export const analysisGoals: CommunityGoalsResponse = { cache: 'refreshed', fetchedAt: '2026-10-07T12:00:00Z', goals: [{
  id: 'cg-research', title: 'Deliver research supplies', systemName: 'Sol', stationName: 'Galileo',
  activityType: 'trade', objective: 'Deliver supplies', targetCommodities: 'Basic Medicines',
  target: 1000, contributed: 125, expiry: '2026-10-08 10:00:00', briefing: 'Register at Galileo.'
}] }

export const analysisContent: GalnetAnalysisContent = {
  summary: 'A supply campaign and a separate uncertain beacon lead.',
  facts: [{ text: 'Supplies are requested at Galileo.', evidence: 'deliver supplies to Galileo in Sol' }],
  interpretations: [{ text: 'The beacon could merit investigation; rewards are unknown.', evidence: 'needs investigation' }],
  entities: [{ name: 'Sol', kind: 'system', role: 'Campaign destination', evidence: 'Galileo in Sol' },
    { name: 'Colonia', kind: 'system', role: 'Investigation destination', evidence: 'beacon in Colonia needs investigation' }],
  activities: [{ title: 'Supply campaign', action: 'See the linked campaign before contributing.',
    evidence: 'deliver supplies to Galileo in Sol', communityGoalId: 'cg-research', relationship: 'explicit', status: 'unknown', destination: null },
  { title: 'Investigate the beacon', action: 'Investigate if interested; outcome unknown.',
    evidence: 'A separate beacon in Colonia needs investigation.', communityGoalId: null, relationship: 'none', status: 'unknown',
    destination: { systemName: 'Colonia', evidence: 'beacon in Colonia needs investigation' } }]
}

export const analysisUsage = { inputTokens: 1200, outputTokens: 400 }

export function savedGalnetAnalysis(overrides: Partial<Extract<GalnetAnalysis, { schemaVersion: 2 }>> = {}): Extract<GalnetAnalysis, { schemaVersion: 2 }> {
  return { schemaVersion: 2, extractorVersion: 'galnet-analysis-v2', cacheKey: 'synthetic-cache',
    articleId: analysisArticle.id, articleRevisionId: 'synthetic-revision', sourceUrl: analysisArticle.sourceUrl,
    publishedAt: analysisArticle.publishedAt, analysedAt: '2026-10-07T12:00:00Z', model: 'synthetic-model',
    communityGoals: structuredClone(analysisGoals), content: structuredClone(analysisContent),
    usage: analysisUsage, ...overrides }
}
