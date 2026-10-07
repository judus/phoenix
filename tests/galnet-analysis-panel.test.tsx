import { act } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, expect, test, vi } from 'vitest'
import type { GalnetAnalysisResponse } from '@phoenix/contracts'
import { GalnetAnalysisPanel, GalnetAnalysisReport } from '../apps/web/src/features/comms/galnet-analysis-panel.js'
import { analysisArticle, analysisContent, analysisGoals, analysisUsage } from './support/galnet-analysis-fixtures.js'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
const empty: GalnetAnalysisResponse = { configured: true, articleAvailable: true, articleChanged: false, analysis: null }
const report = { schemaVersion: 1 as const, extractorVersion: 'galnet-analysis-v1' as const,
  cacheKey: 'synthetic-cache', articleId: analysisArticle.id, articleRevisionId: 'synthetic-revision',
  sourceUrl: analysisArticle.sourceUrl, publishedAt: analysisArticle.publishedAt,
  analysedAt: '2026-10-07T12:00:00Z', model: 'synthetic-model', communityGoals: analysisGoals,
  usage: analysisUsage, content: analysisContent }

test('opening is read-only, explicit action updates the panel and failures retain the saved report', async () => {
  const api = { getGalnetAnalysis: vi.fn(async () => empty), analyseGalnetArticle: vi.fn(async () => ({ ...empty, analysis: report })) }
  const renderer = await renderWithAct(<GalnetAnalysisPanel api={api} articleId={analysisArticle.id} />)
  try {
    expect(api.analyseGalnetArticle).not.toHaveBeenCalled()
    await act(async () => { renderer.root.findByType('button').props.onClick() })
    expect(api.analyseGalnetArticle).toHaveBeenCalledWith(analysisArticle.id, expect.any(AbortSignal))
    expect(JSON.stringify(renderer.toJSON())).toContain('Related Community Goals')
    api.analyseGalnetArticle.mockRejectedValueOnce(new Error('Synthetic provider failure'))
    await act(async () => { renderer.root.findByType('button').props.onClick() })
    const markup = JSON.stringify(renderer.toJSON())
    expect(markup).toContain('Synthetic provider failure')
    expect(markup).toContain('Related Community Goals')
  } finally { await act(async () => renderer.unmount()) }
})

test('disabled configuration still permits reading old reports and warns about changed evidence', async () => {
  const api = { getGalnetAnalysis: vi.fn(async () => ({ ...empty, configured: false, articleChanged: true, analysis: report })),
    analyseGalnetArticle: vi.fn(async () => empty) }
  const renderer = await renderWithAct(<GalnetAnalysisPanel api={api} articleId={analysisArticle.id} />)
  try {
    expect(renderer.root.findByType('button').props.disabled).toBe(true)
    expect(JSON.stringify(renderer.toJSON())).toContain('article has changed')
    expect(JSON.stringify(renderer.toJSON())).toContain('Related Community Goals')
    expect(api.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('late navigation response is aborted and cannot display another article report', async () => {
  let release!: (value: GalnetAnalysisResponse) => void
  const api = { getGalnetAnalysis: vi.fn((_id: string, _signal?: AbortSignal) => new Promise<GalnetAnalysisResponse>(resolve => { release = resolve })),
    analyseGalnetArticle: vi.fn(async () => empty) }
  const renderer = await renderWithAct(<GalnetAnalysisPanel api={api} articleId={analysisArticle.id} />)
  const signal = api.getGalnetAnalysis.mock.calls[0]![1]!
  await act(async () => renderer.unmount())
  expect(signal.aborted).toBe(true)
  await act(async () => release({ ...empty, analysis: report }))
  expect(api.analyseGalnetArticle).not.toHaveBeenCalled()
})

test('CG activities are shown once as canonical references, not repeated as independent leads', () => {
  const markup = renderToStaticMarkup(<GalnetAnalysisReport analysis={report} />)
  expect(markup).toContain('Deliver research supplies')
  expect(markup).toContain('Separate investigation leads')
  const leads = markup.slice(markup.indexOf('Separate investigation leads'))
  expect(leads).toContain('Investigate the beacon')
  expect(leads).not.toContain('Supply campaign')
  expect(markup).toContain('not live gameplay status')
  expect(markup).toContain('Current Community Goals')
})
