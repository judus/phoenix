import { notificationMarkup, notificationText } from './support/notifications.js'
import { act, type ReactTestRenderer } from 'react-test-renderer'
import { useMemo, useState } from 'react'
import { beforeAll, expect, test, vi } from 'vitest'
import type { GalnetArchivedArticle, GalnetArchiveResponse, GalnetCoverageResponse } from '@phoenix/contracts'
import { CommsPage } from '../apps/web/src/features/comms/comms-page.js'
import type { GalnetRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { phoenixApiStub } from './support/phoenix-api-stub.js'
import { renderWithAct } from './support/render-with-act.js'
import { analysisArticle, savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
const archived: GalnetArchivedArticle = { article: { id: analysisArticle.id, title: analysisArticle.title,
  body: analysisArticle.body, image: null, publishedAt: analysisArticle.publishedAt }, sourceUrl: analysisArticle.sourceUrl,
  changedAt: analysisArticle.changedAt, revisionId: 'revision', firstObservedAt: analysisArticle.publishedAt, lastObservedAt: analysisArticle.publishedAt }
const page: GalnetArchiveResponse = { articles: [archived.article], total: 41, limit: 40, offset: 0 }
const button = (renderer: ReactTestRenderer, label: string) => renderer.root.findAllByType('button').find(node => node.children.join('') === label || node.props['aria-label'] === label)!
function api() {
  return { getGalnetArchive: vi.fn(async () => page),
    getGalnetArchivedArticle: vi.fn(async (id: string, _signal?: AbortSignal) => ({ ...archived,
      article: id === archived.article.id ? archived.article : { ...archived.article, id, title: `Retained ${id}`, body: `Text for ${id}` } })),
    getGalnetCoverage: vi.fn(async (): Promise<GalnetCoverageResponse> => ({ subjects: [], reports: [] })),
    getGalnetAnalysis: vi.fn(async () => ({ configured: false, articleAvailable: true, articleChanged: false, contextChanged: false, analysis: null })),
    analyseGalnetArticle: vi.fn(async () => { throw new Error('No inference') }),
    getGalnetBackground: vi.fn(async (_signal?: AbortSignal) => ({ enabled: false, dailyLimit: 10, configured: false, installedAt: analysisArticle.publishedAt,
      lastCheckedAt: null, sourceError: null, requestsToday: 0, pending: 0, jobs: [], backlog: [] })),
    saveGalnetBackground: vi.fn(async () => { throw new Error('No background change') }),
    catchUpGalnet: vi.fn(async () => { throw new Error('No catch-up') }) }
}

function GalnetArchiveBrowser({ api: methods, initialArticleId, initialRoute, feedError }: { api: ReturnType<typeof api>, initialArticleId?: string, initialRoute?: GalnetRoute, feedError?: string }) {
  const [route, setRoute] = useState<GalnetRoute>(initialRoute ?? { kind: 'information', section: 'comms', view: 'galnet', selectedArticleId: initialArticleId })
  const client = useMemo(() => phoenixApiStub(methods), [methods])
  return <CommsPage view="galnet" galnetRoute={route} controller={feedError ? { status: 'error', error: feedError } : { status: 'ready' }}
    analysisApi={client} onNavigate={next => { if (next.kind === 'information' && next.section === 'comms' && next.view === 'galnet') setRoute(next) }}
    onExecuteAction={async () => { throw Error('No command') }} />
}

test('scrolling appends news without resetting selection; search and clearing reset the list without inference', async () => {
  const methods = api()
  const articles = Array.from({ length: 40 }, (_, index) => ({ ...archived.article, id: `article-${index}` }))
  methods.getGalnetArchive.mockResolvedValueOnce({ ...page, articles })
  methods.getGalnetArchive.mockResolvedValueOnce({ ...page, offset: 40, articles: [{ ...archived.article, id: 'article-40' }] })
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} initialArticleId="retained-outside-page" />)
  try {
    expect(methods.getGalnetArchivedArticle).toHaveBeenLastCalledWith('retained-outside-page', expect.any(AbortSignal))
    const header = renderer.root.findAllByType('header').find(node => node.props.className?.includes('page-header'))!
    expect(header.findByType('input').props.id).toBe('galnet-news-search')
    expect(header.findAllByType('button').some(node => node.props['aria-label'] === 'Analysis')).toBe(true)
    expect(button(renderer, 'Analysis').props.className).toContain('btn-icon-square')
    expect(button(renderer, 'Search news').props.className).toContain('btn-primary')
    expect(header.findAll(node => node.props.className === 'input-group filled')).toHaveLength(1)
    expect(button(renderer, 'Next')).toBeUndefined()
    const scroll = () => renderer.root.findByProps({ className: 'galnet-index-scroll' })
    await act(async () => {
      const event = { currentTarget: { scrollTop: 800, scrollHeight: 1000, clientHeight: 200 } }
      scroll().props.onScroll(event)
      scroll().props.onScroll(event)
    })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: '', offset: 40, limit: 40 }, expect.any(AbortSignal))
    expect(methods.getGalnetArchive).toHaveBeenCalledTimes(2)
    expect(renderer.root.findByProps({ 'aria-label': 'GalNet articles' }).findAllByType('li')).toHaveLength(41)
    expect(methods.getGalnetArchivedArticle).toHaveBeenCalledTimes(1)
    await act(async () => { scroll().props.onScroll({ currentTarget: { scrollTop: 900, scrollHeight: 1100, clientHeight: 200 } }) })
    expect(methods.getGalnetArchive).toHaveBeenCalledTimes(2)
    await act(async () => { button(renderer, 'Analysis').props.onClick() })
    await act(async () => { scroll().props.onScroll({ currentTarget: { scrollTop: 900, scrollHeight: 1100, clientHeight: 200 } }) })
    await act(async () => { button(renderer, 'Back to article').props.onClick() })
    expect(renderer.root.findByProps({ 'aria-label': 'GalNet articles' }).findAllByType('li')).toHaveLength(41)
    expect(methods.getGalnetArchive).toHaveBeenCalledTimes(2)
    await act(async () => { renderer.root.findByType('input').props.onChange({ target: { value: ' beacon ' } }) })
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: 'beacon', offset: 0, limit: 40 }, expect.any(AbortSignal))
    await act(async () => { renderer.root.findByProps({ 'aria-label': 'Clear search' }).props.onClick() })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: '', offset: 0, limit: 40 }, expect.any(AbortSignal))
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('failed automatic loading keeps existing news and retries only the next batch', async () => {
  const methods = api()
  methods.getGalnetArchive.mockRejectedValueOnce(new Error('Reading failed'))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} />)
  try {
    await act(async () => { button(renderer, 'Retry').props.onClick() })
    methods.getGalnetArchive.mockRejectedValueOnce(new Error('More news unavailable'))
    const scroll = () => renderer.root.findByProps({ className: 'galnet-index-scroll' })
    const event = { currentTarget: { scrollTop: 800, scrollHeight: 1000, clientHeight: 200 } }
    await act(async () => { scroll().props.onScroll(event) })
    expect(renderer.root.findByProps({ 'aria-label': 'GalNet articles' }).findAllByType('li')).toHaveLength(1)
    const count = methods.getGalnetArchive.mock.calls.length
    await act(async () => { scroll().props.onScroll(event) })
    expect(methods.getGalnetArchive).toHaveBeenCalledTimes(count)
    methods.getGalnetArchive.mockResolvedValueOnce({ ...page, articles: [{ ...archived.article, id: 'second' }], total: 2, offset: 1 })
    await act(async () => { button(renderer, 'Retry').props.onClick() })
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: '', offset: 1, limit: 40 }, expect.any(AbortSignal))
    expect(renderer.root.findByProps({ 'aria-label': 'GalNet articles' }).findAllByType('li')).toHaveLength(2)
  } finally { await act(async () => renderer.unmount()) }
})

test('reading stays AI-independent; analysis preserves the browser and related coverage opens retained text', async () => {
  const methods = api()
  const related = savedGalnetAnalysis({ articleId: 'outside-feed', cacheKey: 'older-report' })
  methods.getGalnetCoverage = vi.fn(async () => ({ subjects: ['Synthetic ship'], reports: [
    { analysis: related, currentArticleTitle: 'Earlier report', articleChanged: false, contextChanged: false },
    { analysis: savedGalnetAnalysis(), currentArticleTitle: analysisArticle.title, articleChanged: false, contextChanged: false }
  ] }))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} initialRoute={{ kind: 'information', section: 'comms', view: 'galnet', search: 'ship' }} />)
  try {
    expect(methods.getGalnetAnalysis).not.toHaveBeenCalled()
    expect(methods.getGalnetCoverage).not.toHaveBeenCalled()
    expect(methods.getGalnetBackground).not.toHaveBeenCalled()
    const reading = renderer.root.findByProps({ className: 'galnet-layout' })
    await act(async () => { button(renderer, 'Analysis').props.onClick() })
    expect(renderer.root.findByProps({ className: 'galnet-layout' })).toBe(reading)
    expect(reading.props.hidden).toBe(true)
    expect(methods.getGalnetAnalysis).toHaveBeenCalled()
    expect(methods.getGalnetBackground).not.toHaveBeenCalled()
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
    expect(methods.catchUpGalnet).not.toHaveBeenCalled()
    await act(async () => { button(renderer, 'Back to article').props.onClick() })
    expect(reading.props.hidden).toBe(false)
    expect(renderer.root.findByType('input').props.value).toBe('ship')
    expect(methods.getGalnetArchive).toHaveBeenCalledTimes(1)
    expect(methods.getGalnetArchive).toHaveBeenLastCalledWith({ query: 'ship', offset: 0, limit: 40 }, expect.any(AbortSignal))
    await act(async () => { button(renderer, 'Analysis').props.onClick() })
    await act(async () => { button(renderer, 'Open article').props.onClick() })
    expect(methods.getGalnetArchivedArticle).toHaveBeenCalledWith('outside-feed', expect.any(AbortSignal))
    expect(renderer.root.findByType('article').findAllByType('h2')[0]!.children).toEqual(['Retained outside-feed'])
    expect(reading.props.hidden).toBe(false)
    expect(renderer.root.findByType('article').props.className).toBe('galnet-reader')
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('archive remains reachable when the feed failed; lookup errors do not show another article', async () => {
  const methods = api()
  methods.getGalnetArchivedArticle.mockRejectedValue(new Error('Retained article not found'))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} feedError="Feed offline" />)
  try {
    expect(notificationText()).toContain('Retained article not found')
    expect(notificationMarkup()).toContain('role="alert"')
    expect(renderer.root.findAll(node => typeof node.type === 'string' && node.props.role === 'alert')).toHaveLength(0)
    expect(renderer.root.findAllByType('article')).toHaveLength(0)
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('background page is independent of the selected report and returning preserves the news browser', async () => {
  const methods = api()
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} initialRoute={{ kind: 'information', section: 'comms', view: 'galnet', search: 'ship', selectedArticleId: 'selected' }} />)
  try {
    const reading = renderer.root.findByProps({ className: 'galnet-layout' })
    await act(async () => { button(renderer, 'Background analysis').props.onClick() })
    expect(reading.props.hidden).toBe(true)
    expect(methods.getGalnetBackground).toHaveBeenCalledTimes(1)
    expect(methods.getGalnetAnalysis).not.toHaveBeenCalled()
    expect(methods.getGalnetCoverage).not.toHaveBeenCalled()
    expect(methods.catchUpGalnet).not.toHaveBeenCalled()
    expect(methods.saveGalnetBackground).not.toHaveBeenCalled()
    await act(async () => { button(renderer, 'Back to news').props.onClick() })
    expect(reading.props.hidden).toBe(false)
    expect(renderer.root.findByType('input').props.value).toBe('ship')
    expect(methods.getGalnetArchive).toHaveBeenCalledTimes(1)
    expect(methods.getGalnetArchivedArticle).toHaveBeenCalledTimes(1)
    expect(methods.getGalnetBackground.mock.calls[0]![0]?.aborted).toBe(true)
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
    expect(notificationText()).toContain('Archive temporarily unavailable')
    await act(async () => { button(renderer, 'Retry').props.onClick() })
    expect(notificationText()).not.toContain('Archive temporarily unavailable')
    expect(methods.getGalnetArchivedArticle).toHaveBeenCalledWith(analysisArticle.id, expect.any(AbortSignal))
    expect(methods.analyseGalnetArticle).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('native selection cancels a pending reader and late text cannot replace the selected article', async () => {
  const methods = api()
  methods.getGalnetArchive.mockResolvedValue({ ...page, total: 2, articles: [archived.article, { ...archived.article, id: 'second' }] })
  let release!: (value: GalnetArchivedArticle) => void
  methods.getGalnetArchivedArticle.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const renderer = await renderWithAct(<GalnetArchiveBrowser api={methods} />)
  try {
    const signal = methods.getGalnetArchivedArticle.mock.calls[0]![1]
    const newsList = () => renderer.root.findAllByType('ul').find(node => node.props['aria-label'] === 'GalNet articles')!
    const choices = newsList().findAllByType('button')
    expect(choices[0]!.props['aria-pressed']).toBe(true)
    expect(choices[1]!.props['aria-pressed']).toBe(false)
    await act(async () => { choices[1]!.props.onClick() })
    expect(newsList().findAllByType('button')[1]!.props['aria-pressed']).toBe(true)
    expect(signal?.aborted).toBe(true)
    await act(async () => { release(archived) })
    expect(renderer.root.findByType('article').findAllByType('h2')[0]!.children).toEqual(['Retained second'])
    expect(JSON.stringify(renderer.toJSON())).toContain('Text for second')
  } finally { await act(async () => renderer.unmount()) }
})
