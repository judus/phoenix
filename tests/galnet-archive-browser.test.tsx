import { act, type ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { GalnetArchivedArticle, GalnetArchiveResponse, GalnetCoverageResponse } from '@phoenix/contracts'
import { GalnetArchiveBrowser } from '../apps/web/src/features/comms/galnet-archive-browser.js'
import { CommsPage } from '../apps/web/src/features/comms/comms-page.js'
import { phoenixApiStub } from './support/phoenix-api-stub.js'
import { renderWithAct } from './support/render-with-act.js'
import { analysisArticle, savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
const archived: GalnetArchivedArticle = { article: { id: analysisArticle.id, title: analysisArticle.title,
  body: analysisArticle.body, image: null, publishedAt: analysisArticle.publishedAt }, sourceUrl: analysisArticle.sourceUrl,
  changedAt: analysisArticle.changedAt, revisionId: 'revision', firstObservedAt: analysisArticle.publishedAt, lastObservedAt: analysisArticle.publishedAt }
const page: GalnetArchiveResponse = { articles: [archived.article], total: 41, limit: 40, offset: 0 }
const button = (renderer: ReactTestRenderer, label: string) => renderer.root.findAllByType('button').find(node => node.children.join('') === label)!
function api() {
  return { getGalnetArchive: vi.fn(async () => page),
    getGalnetArchivedArticle: vi.fn(async (id: string, _signal?: AbortSignal) => ({ ...archived,
      article: id === archived.article.id ? archived.article : { ...archived.article, id, title: `Retained ${id}`, body: `Text for ${id}` } })),
    getGalnetCoverage: vi.fn(async (): Promise<GalnetCoverageResponse> => ({ subjects: [], reports: [] })),
    getGalnetAnalysis: vi.fn(async () => ({ configured: false, articleAvailable: true, articleChanged: false, contextChanged: false, analysis: null })),
    analyseGalnetArticle: vi.fn(async () => { throw new Error('No inference') }) }
}

test('archive search and paging reset selection; browsing and clearing never request analysis', async () => {
  const methods = api()
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} initialArticleId="retained-outside-page" />)
  try {
    expect(methods.getGalnetArchivedArticle).toHaveBeenLastCalledWith('retained-outside-page', expect.any(AbortSignal))
    await act(async () => { button(renderer, 'Next').props.onClick() })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: '', offset: 40, limit: 40 }, expect.any(AbortSignal))
    expect(methods.getGalnetArchivedArticle).toHaveBeenLastCalledWith(analysisArticle.id, expect.any(AbortSignal))
    await act(async () => { renderer.root.findByType('input').props.onChange({ target: { value: ' beacon ' } }) })
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: 'beacon', offset: 0, limit: 40 }, expect.any(AbortSignal))
    await act(async () => { button(renderer, 'Clear').props.onClick() })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: '', offset: 0, limit: 40 }, expect.any(AbortSignal))
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('related coverage opens retained text outside the latest feed and keeps Latest separate', async () => {
  const methods = api()
  const related = savedGalnetAnalysis({ articleId: 'outside-feed', cacheKey: 'older-report' })
  methods.getGalnetCoverage = vi.fn(async () => ({ subjects: ['Synthetic ship'], reports: [
    { analysis: related, currentArticleTitle: 'Earlier report', articleChanged: false, contextChanged: false },
    { analysis: savedGalnetAnalysis(), currentArticleTitle: analysisArticle.title, articleChanged: false, contextChanged: false }
  ] }))
  const renderer = await renderWithAct(<CommsPage view="galnet" controller={{ status: 'ready', galnet: {
    articles: [archived.article], fetchedAt: analysisArticle.publishedAt, cache: 'fresh'
  } }} analysisApi={phoenixApiStub(methods)} onExecuteAction={async () => { throw Error('No command') }} />)
  try {
    await act(async () => { button(renderer, 'Open article').props.onClick() })
    expect(methods.getGalnetArchivedArticle).toHaveBeenCalledWith('outside-feed', expect.any(AbortSignal))
    expect(renderer.root.findByType('article').findAllByType('h2')[0]!.children).toEqual(['Retained outside-feed'])
    await act(async () => { button(renderer, 'Latest news').props.onClick() })
    expect(renderer.root.findByType('article').props.className).toBe('galnet-reader')
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('archive remains reachable when the feed failed; lookup errors do not show another article', async () => {
  const methods = api()
  methods.getGalnetArchivedArticle.mockRejectedValue(new Error('Retained article not found'))
  const renderer = await renderWithAct(<CommsPage view="galnet" controller={{ status: 'error', error: 'Feed offline' }}
    analysisApi={phoenixApiStub(methods)} onExecuteAction={async () => { throw Error('No command') }} />)
  try {
    await act(async () => { button(renderer, 'Archive').props.onClick() })
    expect(JSON.stringify(renderer.toJSON())).toContain('Retained article not found')
    expect(renderer.root.findAll(node => typeof node.type === 'string' && node.props.role === 'alert')).toHaveLength(1)
    expect(renderer.root.findAllByType('article')).toHaveLength(0)
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('late archive search results cannot overwrite a newer search or select its article', async () => {
  const methods = api()
  let release!: (value: GalnetArchiveResponse) => void
  methods.getGalnetArchive.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} />)
  try {
    await act(async () => { renderer.root.findByType('input').props.onChange({ target: { value: 'missing' } }) })
    methods.getGalnetArchive.mockResolvedValue({ articles: [], total: 0, offset: 0, limit: 40 })
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    await act(async () => { release(page) })
    expect(JSON.stringify(renderer.toJSON())).toContain('No retained articles match')
    expect(methods.getGalnetArchivedArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('a failed search can be retried without keeping its error or triggering analysis', async () => {
  const methods = api()
  methods.getGalnetArchive.mockRejectedValueOnce(new Error('Archive temporarily unavailable'))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} />)
  try {
    expect(JSON.stringify(renderer.toJSON())).toContain('Archive temporarily unavailable')
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Archive temporarily unavailable')
    expect(methods.getGalnetArchivedArticle).toHaveBeenCalledWith(analysisArticle.id, expect.any(AbortSignal))
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('keyboard selection cancels a pending reader and late text cannot replace the selected article', async () => {
  const methods = api()
  methods.getGalnetArchive.mockResolvedValue({ ...page, total: 2, articles: [archived.article, { ...archived.article, id: 'second' }] })
  let release!: (value: GalnetArchivedArticle) => void
  methods.getGalnetArchivedArticle.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} />)
  try {
    const signal = methods.getGalnetArchivedArticle.mock.calls[0]![1]
    await act(async () => { renderer.root.findAllByType('li')[1]!.props.onKeyDown({ key: 'Enter', preventDefault() {} }) })
    expect(signal?.aborted).toBe(true)
    await act(async () => { release(archived) })
    expect(renderer.root.findByType('article').findAllByType('h2')[0]!.children).toEqual(['Retained second'])
    expect(JSON.stringify(renderer.toJSON())).toContain('Text for second')
  } finally { await act(async () => renderer.unmount()) }
})
