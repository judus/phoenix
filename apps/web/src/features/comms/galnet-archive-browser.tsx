import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GalnetArchiveQuery, GalnetArchiveResponse } from '@phoenix/contracts'
import { Notification, Button, ControlContext, DataTableGroup, Form, IconButton, InputGroup, CrossIcon, SearchIcon, AnalysisIcon, QueueIcon, ItemList, ItemListItem, Status, TextInput } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { GalnetRoute } from '../../application/navigation/phoenix-route.js'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'
import { GalnetArticleReader } from './galnet-article-reader.js'
import { GalnetAnalysisPage } from './galnet-analysis-page.js'
import { GalnetBackgroundPanel } from './galnet-background-panel.js'
import { useGalnetArticle } from './use-galnet-article.js'

export type GalnetBrowserApi = Pick<PhoenixApi, 'getGalnetArchive' | 'getGalnetArchivedArticle' | 'getGalnetAnalysis' | 'analyseGalnetArticle' | 'getGalnetCoverage' | 'getGalnetBackground' | 'saveGalnetBackground' | 'catchUpGalnet'>

export function GalnetArchiveBrowser({ api, route, onNavigate, header }: { api: GalnetBrowserApi, route: GalnetRoute, onNavigate(route: GalnetRoute): void, header(actions: ReactNode): ReactNode }) {
  const [text, setText] = useState(route.search ?? '')
  useEffect(() => setText(route.search ?? ''), [route.search])
  const query = useMemo<GalnetArchiveQuery>(() => ({ query: route.search ?? '', offset: 0, limit: 40 }), [route.search])
  const search = (value: string) => {
    const { selectedArticleId: _article, search: _search, page: _page, ...base } = route
    onNavigate({ ...base, ...(value ? { search: value } : {}) })
  }
  return <ArchivePage key={query.query} api={api} query={query} route={route} onNavigate={onNavigate} header={header}
    search={<ControlContext context="toolbar" density="regular"><Form className="galnet-search" onSubmit={event => { event.preventDefault(); search(text.trim()) }}>
      <InputGroup className="filled" htmlFor="galnet-news-search" label="Search" action={<IconButton variant="primary" label="Search news" type="submit"><SearchIcon /></IconButton>}>
        <TextInput id="galnet-news-search" type="search" maxLength={200} value={text} onChange={event => setText(event.target.value)} />
      </InputGroup>
      {(text || route.search) && <IconButton label="Clear search" onClick={() => { setText(''); search('') }}><CrossIcon /></IconButton>}
    </Form></ControlContext>} />
}

function ArchivePage({ api, query, route, onNavigate, search, header }: {
  api: GalnetBrowserApi, query: GalnetArchiveQuery, route: GalnetRoute, onNavigate(route: GalnetRoute): void, search: ReactNode, header(actions: ReactNode): ReactNode
}) {
  const [page, setPage] = useState<GalnetArchiveResponse>()
  const [error, setError] = useState<string>()
  const [request, setRequest] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const pending = useRef(true)
  const scroll = useRef<HTMLDivElement>(null)
  // One keyed search owns its requests. Reading DOM stays mounted during analysis.
  useEffect(() => {
    const controller = new AbortController()
    pending.current = true
    setLoading(true)
    setError(undefined)
    void api.getGalnetArchive({ ...query, offset }, controller.signal).then(result => {
      if (!controller.signal.aborted) setPage(previous => offset === 0 ? result : { ...result, articles: [...previous!.articles, ...result.articles] })
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'News unavailable.') })
      .finally(() => { if (!controller.signal.aborted) { pending.current = false; setLoading(false) } })
    return () => controller.abort()
  }, [api, query, offset, request])
  const loadMore = useCallback((element: Pick<HTMLDivElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>) => {
    if (pending.current || error || route.page || !page || page.articles.length >= page.total) return
    if (element.scrollHeight - element.scrollTop - element.clientHeight > element.clientHeight / 2) return
    pending.current = true
    setOffset(page.articles.length)
  }, [page, error, route.page])
  useEffect(() => { if (!loading && scroll.current) loadMore(scroll.current) }, [loading, loadMore])
  const selected = route.selectedArticleId ?? page?.articles[0]?.id
  const open = (id: string, page?: GalnetRoute['page']) => onNavigate({ ...route, selectedArticleId: id, page })
  return <>
    {header(<>{search}<IconButton label="Analysis" disabled={!selected} onClick={() => selected && open(selected, 'analysis')}><AnalysisIcon /></IconButton>
      <IconButton label="Background analysis" onClick={() => onNavigate({ ...route, page: 'background' })}><QueueIcon /></IconButton></>)}
    <div className="galnet-layout" hidden={Boolean(route.page)}>
      <DataTableGroup className="galnet-index" title="News" meta={page ? `${page.total} articles` : undefined}>
        <div className="galnet-index-content">
          <div className="galnet-index-scroll" ref={scroll} tabIndex={0} onScroll={event => loadMore(event.currentTarget)}>
            <Notification message={error} />
            {!page ? !error && <Status tone="muted">Reading news…</Status>
              : page.articles.length === 0 ? <Status tone="muted">No retained articles match.</Status>
                : <ItemList className="surface" density="compact" aria-label="GalNet articles">{page.articles.map(article =>
                  <ItemListItem key={article.id} title={article.title} selected={selected === article.id}
                    eyebrow={<PhoenixDateTime value={article.publishedAt} precision="date" />}
                    onActivate={() => open(article.id)} />)}</ItemList>}
            {page && loading && <Status tone="muted">Reading more news…</Status>}
            {error && <Button onClick={() => setRequest(value => value + 1)}>Retry</Button>}
          </div>
        </div>
      </DataTableGroup>
      {selected ? <ArchivedReader key={selected} api={api} articleId={selected} />
        : <DataTableGroup className="galnet-reader-group" title="GalNet article"><Status tone="muted">Select an article.</Status></DataTableGroup>}
    </div>
    {route.page === 'analysis' && <GalnetAnalysisPage key={selected} api={api} articleId={selected} onOpen={id => open(id)} />}
    {route.page === 'background' && <GalnetBackgroundPanel api={api} readingRoute={{ ...route, page: undefined }} />}
  </>
}

function ArchivedReader({ api, articleId }: { api: GalnetBrowserApi, articleId: string }) {
  const { article: retained, error } = useGalnetArticle(api, articleId)
  return <DataTableGroup className="galnet-reader-group" title="GalNet article"
    meta={retained ? <PhoenixDateTime value={retained.article.publishedAt} precision="date" /> : undefined}>
    {error ? <Notification message={error} /> : retained
      ? <GalnetArticleReader article={retained.article} />
      : <Status tone="muted">Reading article…</Status>}
  </DataTableGroup>
}
