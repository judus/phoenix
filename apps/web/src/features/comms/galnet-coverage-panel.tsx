import { useEffect, useState } from 'react'
import type { GalnetCoverageResponse } from '@phoenix/contracts'
import { Button, DataTableGroup, ItemList, ItemListItem, Stack, Status } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'

export function GalnetCoveragePanel({ api, articleId, onOpen }: { api: Pick<PhoenixApi, 'getGalnetCoverage'>, articleId: string, onOpen(articleId: string): void }) {
  const [coverage, setCoverage] = useState<GalnetCoverageResponse>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const next = await api.getGalnetCoverage(articleId, controller.signal)
        if (!controller.signal.aborted) { setCoverage(next); setError(undefined) }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Related coverage unavailable.')
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 5_000)
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [api, articleId])
  if (!error && (!coverage || coverage.reports.length < 2)) return null
  return <DataTableGroup title="Related coverage" contentGap="sm"><Stack gap="sm">
    {error && <Status wrap tone="warning">{error}</Status>}
    {coverage && <>
      <Status tone="muted" wrap>Shared subjects: {coverage.subjects.join(' · ')}. Related reports, not confirmed same activities or live availability.</Status>
      <ItemList density="compact">{coverage.reports.map(({ analysis, currentArticleTitle, articleChanged }) => <ItemListItem key={analysis.cacheKey}
        title={currentArticleTitle ?? 'Archived article'}
        eyebrow={<PhoenixDateTime value={analysis.publishedAt} precision="date" />}
        description={analysis.content.summary}
        meta={<><Button size="sm" onClick={() => onOpen(analysis.articleId)}>Open article</Button>{' · '}<a href={analysis.sourceUrl} target="_blank" rel="noreferrer">Source</a>{articleChanged ? ' · Article changed' : ''}
          {analysis.content.activities.map((activity, index) => <span key={index}><br />{activity.title} · {activity.status}{activity.communityGoalId ? ' · Community Goal reference' : ''}</span>)}</>} />)}</ItemList>
    </>}
  </Stack></DataTableGroup>
}
