import { Notification, Stack, Status } from '@phoenix/ui'
import type { GalnetBrowserApi } from './galnet-archive-browser.js'
import { GalnetAnalysisPanel } from './galnet-analysis-panel.js'
import { GalnetCoveragePanel } from './galnet-coverage-panel.js'
import { useGalnetArticle } from './use-galnet-article.js'

export function GalnetAnalysisPage({ api, articleId, onOpen }: { api: GalnetBrowserApi, articleId?: string, onOpen(articleId: string): void }) {
  return <div className="galnet-analysis-layout">
    <section className="galnet-analysis-scroll" aria-label="Article analysis">
      {articleId ? <ArticleAnalysis key={articleId} api={api} articleId={articleId} onOpen={onOpen} />
        : <Status tone="muted">Select an article in GalNet to inspect its analysis.</Status>}
    </section>
  </div>
}

function ArticleAnalysis({ api, articleId, onOpen }: { api: GalnetBrowserApi, articleId: string, onOpen(articleId: string): void }) {
  const { article, error } = useGalnetArticle(api, articleId)
  return <Stack gap="lg">
    <Notification message={error} />
    {article ? <h2>{article.article.title}</h2> : !error && <Status tone="muted">Reading article…</Status>}
    <GalnetAnalysisPanel api={api} articleId={articleId} />
    <GalnetCoveragePanel api={api} articleId={articleId} onOpen={onOpen} />
  </Stack>
}
