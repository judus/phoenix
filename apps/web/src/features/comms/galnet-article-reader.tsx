import type { GalnetArticle } from '@phoenix/contracts'
import { Stack } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { GalnetAnalysisPanel } from './galnet-analysis-panel.js'
import { GalnetCoveragePanel } from './galnet-coverage-panel.js'

export type GalnetReaderApi = Pick<PhoenixApi, 'getGalnetAnalysis' | 'analyseGalnetArticle' | 'getGalnetCoverage'>

export function GalnetArticleReader({ article, api, onOpen, sourceUrl }: {
  article: GalnetArticle, api: GalnetReaderApi, onOpen(articleId: string): void, sourceUrl?: string
}) {
  return <article className="galnet-reader">
    <header><small>GalNet{sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noreferrer">Source</a></>}</small><h2>{article.title}</h2></header>
    <div className="article-body" tabIndex={0}><Stack gap="lg">
      <div className="article-text">{article.body.split(/\r?\n/u).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      <GalnetCoveragePanel api={api} articleId={article.id} onOpen={onOpen} />
      <GalnetAnalysisPanel api={api} articleId={article.id} />
    </Stack></div>
  </article>
}
