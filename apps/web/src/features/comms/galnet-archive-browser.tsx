import { useEffect, useState, type ReactNode } from 'react'
import type { GalnetArchiveQuery, GalnetArchiveResponse, GalnetArchivedArticle } from '@phoenix/contracts'
import { Button, DataTableGroup, Field, Form, Inline, ItemList, ItemListItem, Stack, Status, TextInput } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'
import { GalnetArticleReader, type GalnetReaderApi } from './galnet-article-reader.js'

type ArchiveApi = GalnetReaderApi & Pick<PhoenixApi, 'getGalnetArchive' | 'getGalnetArchivedArticle'>

export function GalnetArchiveBrowser({ api, initialArticleId }: { api: ArchiveApi, initialArticleId?: string }) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState<GalnetArchiveQuery>({ query: '', offset: 0, limit: 40 })
  const [selectedId, setSelectedId] = useState(initialArticleId)
  return <ArchivePage key={`${query.query}:${query.offset}`} api={api} query={query} selectedId={selectedId} onSelect={setSelectedId}
    onPage={offset => { setSelectedId(undefined); setQuery(current => ({ ...current, offset })) }}
    search={<Form onSubmit={event => { event.preventDefault(); setSelectedId(undefined); setQuery(current => ({ ...current, query: text.trim(), offset: 0 })) }}>
      <Field label="Search retained news" htmlFor="galnet-archive-search"><TextInput className="form-mini"
        type="search" maxLength={200} value={text} onChange={event => setText(event.target.value)} /></Field>
      <Inline><Button size="sm" type="submit">Search</Button><Button size="sm" type="button" onClick={() => {
        setText(''); setSelectedId(undefined); setQuery(current => ({ ...current, query: '', offset: 0 }))
      }}>Clear</Button></Inline>
    </Form>} />
}

function ArchivePage({ api, query, selectedId, onSelect, onPage, search }: {
  api: ArchiveApi, query: GalnetArchiveQuery, selectedId?: string, onSelect(articleId: string): void,
  onPage(offset: number): void, search: ReactNode
}) {
  const [page, setPage] = useState<GalnetArchiveResponse>()
  const [error, setError] = useState<string>()
  // This keyed page owns one search/pagination request; late responses cannot populate another page.
  useEffect(() => {
    const controller = new AbortController()
    setPage(undefined)
    setError(undefined)
    void api.getGalnetArchive(query, controller.signal).then(result => {
      if (!controller.signal.aborted) setPage(result)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Archive unavailable.') })
    return () => controller.abort()
  }, [api, query])
  const selected = selectedId ?? page?.articles[0]?.id
  return <div className="galnet-layout">
    <DataTableGroup className="galnet-index" title="Retained archive" meta={page ? `${page.total} articles` : undefined}>
      <div className="galnet-index-scroll"><Stack gap="md">
        {search}
        <Status tone="muted" wrap>Articles observed by PHOENIX, not a complete historical feed. Search titles and text.</Status>
        {error ? <Status tone="danger" wrap role="alert">{error}</Status> : !page ? <Status tone="muted">Reading archive…</Status>
          : page.articles.length === 0 ? <Status tone="muted">No retained articles match.</Status>
            : <ItemList className="surface" density="compact" aria-label="Archived GalNet articles">{page.articles.map(article =>
              <ItemListItem key={article.id} title={article.title} selected={selected === article.id} tabIndex={0}
                eyebrow={<PhoenixDateTime value={article.publishedAt} precision="date" />}
                onClick={() => onSelect(article.id)} onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(article.id) }
                }} />)}</ItemList>}
        {page && <Inline justify="space-between">
          <Button size="sm" disabled={query.offset === 0} onClick={() => onPage(Math.max(0, query.offset - query.limit))}>Previous</Button>
          <Status tone="muted">{page.total === 0 ? '0' : `${Math.min(query.offset + 1, page.total)}–${Math.min(query.offset + query.limit, page.total)}`} / {page.total}</Status>
          <Button size="sm" disabled={query.offset + query.limit >= page.total} onClick={() => onPage(query.offset + query.limit)}>Next</Button>
        </Inline>}
      </Stack></div>
    </DataTableGroup>
    {selected ? <ArchivedReader key={selected} api={api} articleId={selected} onOpen={onSelect} />
      : <DataTableGroup className="galnet-reader-group" title="GalNet article"><Status tone="muted">Select a retained article.</Status></DataTableGroup>}
  </div>
}

function ArchivedReader({ api, articleId, onOpen }: { api: ArchiveApi, articleId: string, onOpen(articleId: string): void }) {
  const [retained, setRetained] = useState<GalnetArchivedArticle>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    const controller = new AbortController()
    void api.getGalnetArchivedArticle(articleId, controller.signal).then(result => {
      if (!controller.signal.aborted) setRetained(result)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Retained article unavailable.') })
    return () => controller.abort()
  }, [api, articleId])
  return <DataTableGroup className="galnet-reader-group" title="Retained article"
    meta={retained ? <PhoenixDateTime value={retained.article.publishedAt} precision="date" /> : undefined}>
    {error ? <Status tone="danger" wrap role="alert">{error}</Status> : retained
      ? <GalnetArticleReader article={retained.article} api={api} onOpen={onOpen} sourceUrl={retained.sourceUrl} />
      : <Status tone="muted">Reading retained article…</Status>}
  </DataTableGroup>
}
